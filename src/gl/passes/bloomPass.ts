/**
 * Bloom pass: two-pass separable Gaussian blur of the bright buffer.
 *   H-blur: source → temp
 *   V-blur: temp   → output
 */

import type REGL from 'regl';
// @ts-ignore
import fullscreenVert from '../shaders/fullscreen.vert';
// @ts-ignore
import bloomFrag from '../shaders/bloomBlur.frag';

type Draw = (props: Record<string, unknown>) => void;
const QUAD: [number, number][] = [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]];

export interface BloomDrawProps {
  /** Bright-extracted buffer to blur. */
  source: REGL.Framebuffer2D;
  /** Temp FBO for first pass. */
  temp: REGL.Framebuffer2D;
  /** Final bloom output. */
  output: REGL.Framebuffer2D;
  halfWidth: number;
  halfHeight: number;
  fogAmount: number;
}

export function createBloomPass(regl: REGL.Regl) {
  const drawBlur: Draw = regl({
    vert: fullscreenVert,
    frag: bloomFrag,
    attributes: { position: QUAD },
    uniforms: {
      uSource:    regl.prop('uSource'    as never),
      uDirection: regl.prop('uDirection' as never),
      uFogAmount: regl.prop('uFogAmount' as never),
    },
    framebuffer: regl.prop('framebuffer' as never),
    count: 6,
    depth: { enable: false },
  }) as unknown as Draw;

  return {
    draw(p: BloomDrawProps) {
      // H-blur: source → temp
      drawBlur({
        uSource:    p.source,
        uDirection: [1.0 / p.halfWidth, 0],
        uFogAmount: p.fogAmount,
        framebuffer: p.temp,
      });
      // V-blur: temp → output
      drawBlur({
        uSource:    p.temp,
        uDirection: [0, 1.0 / p.halfHeight],
        uFogAmount: p.fogAmount,
        framebuffer: p.output,
      });
    },
  };
}
