/**
 * Godrays pass: radial blur of bright buffer toward the projected sun position.
 */

import type REGL from 'regl';
// @ts-ignore
import fullscreenVert from '../shaders/fullscreen.vert';
// @ts-ignore
import godraysFrag from '../shaders/godrays.frag';

type Draw = (props: Record<string, unknown>) => void;
const QUAD: [number, number][] = [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]];

export interface GodraysDrawProps {
  source: REGL.Framebuffer2D;
  framebuffer: REGL.Framebuffer2D;
  lightScreenPos: [number, number];
  auroraEnergy: number;
  sunHeight: number;
}

export function createGodraysPass(regl: REGL.Regl) {
  const draw: Draw = regl({
    vert: fullscreenVert,
    frag: godraysFrag,
    attributes: { position: QUAD },
    uniforms: {
      uBright:         regl.prop('source'          as never),
      uLightScreenPos: regl.prop('lightScreenPos'  as never),
      uAuroraEnergy:   regl.prop('auroraEnergy'    as never),
      uSunHeight:      regl.prop('sunHeight'       as never),
    },
    framebuffer: regl.prop('framebuffer' as never),
    count: 6,
    depth: { enable: false },
  }) as unknown as Draw;

  return {
    draw(p: GodraysDrawProps) {
      draw(p as any);
    },
  };
}
