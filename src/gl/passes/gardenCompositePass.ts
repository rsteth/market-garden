/**
 * Garden composite pass: combines base + bloom + godrays, applies fog + grade.
 */

import type REGL from 'regl';
import fullscreenVert from '../shaders/fullscreen.vert';
import compositeFrag from '../shaders/gardenComposite.frag';

type Draw = (props: Record<string, unknown>) => void;
const QUAD: [number, number][] = [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]];

export interface GardenCompositeDrawProps {
  base: REGL.Framebuffer2D;
  bloom: REGL.Framebuffer2D;
  rays: REGL.Framebuffer2D;
  fogAmount: number;
  sunHeight: number;
  godraysIntensity: number;
  dayPhase: number;
  treatment: number;
}

export function createGardenCompositePass(regl: REGL.Regl) {
  const draw: Draw = regl({
    vert: fullscreenVert,
    frag: compositeFrag,
    attributes: { position: QUAD },
    uniforms: {
      uBase:         regl.prop('base'         as never),
      uBloom:        regl.prop('bloom'        as never),
      uRays:         regl.prop('rays'         as never),
      uFogAmount:    regl.prop('fogAmount'    as never),
      uSunHeight:    regl.prop('sunHeight'    as never),
      uGodraysIntensity: regl.prop('godraysIntensity' as never),
      uDayPhase:     regl.prop('dayPhase'     as never),
      uTreatment:    regl.prop('treatment'    as never),
    },
    count: 6,
    depth: { enable: false },
  }) as unknown as Draw;

  return {
    draw(p: GardenCompositeDrawProps) {
      draw(p as unknown as Record<string, unknown>);
    },
  };
}
