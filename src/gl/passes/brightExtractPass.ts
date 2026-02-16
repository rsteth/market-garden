/**
 * Bright-extract pass: reads base FBO, outputs bright regions for bloom + godrays.
 */

import type REGL from 'regl';
// @ts-ignore
import fullscreenVert from '../shaders/fullscreen.vert';
// @ts-ignore
import brightFrag from '../shaders/brightExtract.frag';

type Draw = (props: Record<string, unknown>) => void;
const QUAD: [number, number][] = [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]];

export interface BrightExtractDrawProps {
  source: REGL.Framebuffer2D;
  framebuffer: REGL.Framebuffer2D;
  auroraEnergy: number;
  fogAmount: number;
}

export function createBrightExtractPass(regl: REGL.Regl) {
  const draw: Draw = regl({
    vert: fullscreenVert,
    frag: brightFrag,
    attributes: { position: QUAD },
    uniforms: {
      uBase:         regl.prop('source'       as never),
      uAuroraEnergy: regl.prop('auroraEnergy' as never),
      uFogAmount:    regl.prop('fogAmount'    as never),
    },
    framebuffer: regl.prop('framebuffer' as never),
    count: 6,
    depth: { enable: false },
  }) as unknown as Draw;

  return {
    draw(p: BrightExtractDrawProps) {
      draw(p as any);
    },
  };
}
