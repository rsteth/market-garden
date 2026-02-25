/**
 * Market data texture: fetch binary blob, upload as 4x8 RGBA32F,
 * and extract global environment signals.
 */

import type REGL from 'regl';
import type { Vec3 } from './camera';

// ---- types ----

export interface MarketEnvironment {
  windStrength: number;
  gustiness: number;
  fogAmount: number;
  auroraEnergy: number;
  dayPhase: number;
  sunHeight: number;
  sunDir: Vec3;
}

// ---- fetch ----

export async function fetchMarketData(url = '/market-texture.bin'): Promise<Float32Array> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Market texture request failed: ${res.status} ${res.statusText}`);
  }

  const width = Number(res.headers.get('X-MarketTex-Width') ?? '4');
  const height = Number(res.headers.get('X-MarketTex-Height') ?? '8');
  const format = res.headers.get('X-MarketTex-Format') ?? 'RGBA32F';

  const buf = await res.arrayBuffer();
  const floats = new Float32Array(buf);

  if (floats.length !== 128) {
    throw new Error(`Unexpected market texture payload length: ${floats.length}`);
  }

  if (width !== 4 || height !== 8 || format !== 'RGBA32F') {
    throw new Error(`Unexpected market texture layout: ${width}x${height} ${format}`);
  }

  return floats;
}

// ---- upload ----

/**
 * Upload market data into a float texture via raw GL calls.
 * This bypasses regl's extension check for `type: 'float'`.
 */
export function uploadMarketTexture(
  gl: WebGL2RenderingContext,
  texture: REGL.Texture2D,
  data: Float32Array,
): void {
  const glTex = (texture as unknown as { _texture: { texture: WebGLTexture } })
    ._texture.texture;

  gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA32F,
    4, 8, 0,
    gl.RGBA, gl.FLOAT, data,
  );
  gl.bindTexture(gl.TEXTURE_2D, null);
}

// ---- environment extraction ----

export function extractEnvironment(
  data: Float32Array,
  nowUtcSeconds: number,
): MarketEnvironment {
  // meta row = y=7, each row = 4 texels * 4 channels = 16 floats
  const m = 7 * 16;
  const vixLevel  = data[m + 0]; // [-1,1]
  const vixChange = data[m + 1];
  const spyRet    = data[m + 2];
  const ndxRet    = data[m + 3];
  const openUtc   = data[m + 4];
  const closeUtc  = data[m + 5];

  const windStrength  = clamp01(vixLevel * 0.5 + 0.5);
  const gustiness     = clamp01(Math.abs(vixChange));
  const fogAmount     = clamp01(-spyRet * 0.5 + 0.5);
  const auroraEnergy  = clamp01(Math.abs(ndxRet));

  // sun cycle
  let dayPhase = 0.5;
  if (closeUtc > openUtc) {
    dayPhase = clamp01((nowUtcSeconds - openUtc) / (closeUtc - openUtc));
  }
  
  const { sunHeight, sunDir } = calculateSun(dayPhase);

  return { windStrength, gustiness, fogAmount, auroraEnergy, dayPhase, sunHeight, sunDir };
}

export function calculateSun(dayPhase: number): { sunHeight: number; sunDir: Vec3 } {
  const sunHeight = Math.sin(Math.PI * dayPhase);

  const maxAz = 1.2;
  const sunAzimuth = (dayPhase * 2 - 1) * maxAz;
  const rawDir: Vec3 = [
    Math.cos(sunAzimuth),
    Math.max(0.08, sunHeight),
    Math.sin(sunAzimuth),
  ];
  const len = Math.hypot(...rawDir);
  const sunDir: Vec3 = [rawDir[0] / len, rawDir[1] / len, rawDir[2] / len];

  return { sunHeight, sunDir };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
