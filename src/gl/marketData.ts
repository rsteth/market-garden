/**
 * Market data texture: fetch binary blob, upload as 2x8 RGBA32F,
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

export async function fetchMarketData(url = '/api/market-data'): Promise<Float32Array> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return new Float32Array(buf);
}

// ---- upload ----

export function uploadMarketTexture(
  texture: REGL.Texture2D,
  data: Float32Array,
): void {
  // Always upload as float — WebGL2 can sample float textures without
  // EXT_color_buffer_float; that ext is only needed for *rendering* to them.
  (texture as any)({
    width: 2,
    height: 8,
    data,
    format: 'rgba',
    type: 'float',
    min: 'nearest',
    mag: 'nearest',
    wrap: 'clamp',
  });
}

// ---- environment extraction ----

export function extractEnvironment(
  data: Float32Array,
  nowUtcSeconds: number,
): MarketEnvironment {
  // meta row = y=7, each row = 2 texels * 4 channels = 8 floats
  const m = 7 * 8;
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

  return { windStrength, gustiness, fogAmount, auroraEnergy, dayPhase, sunHeight, sunDir };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
