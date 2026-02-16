import type { RenderResources, Pass } from './types';
import type { UniformState } from '../uniformBus';
import fullscreenVert from '../shaders/fullscreen.vert';
import commonGlsl from '../shaders/common.glsl';
import simFrag from '../shaders/sim.frag';

const FULLSCREEN_QUAD: [number, number][] = [
  [-1, -1], [1, -1], [-1, 1],
  [-1, 1],  [1, -1], [1,  1],
];

/**
 * Ping-pong simulation pass.
 * Reads from pingPong.read, writes into pingPong.write, then swaps.
 */
export function createSimPass(): Pass {
  let drawSim: (props: Record<string, unknown>) => void;
  let resources: RenderResources;

  return {
    name: 'sim',
    init(regl, res) {
      resources = res;

      // Prepend precision + common helpers to the fragment source
      const fragSource = `precision highp float;\n${commonGlsl}\n${simFrag}`;

      drawSim = regl({
        vert: fullscreenVert,
        frag: fragSource,
        attributes: { position: FULLSCREEN_QUAD },
        uniforms: {
          previousFrame: regl.prop('previousFrame' as never),
          dataTexture: regl.prop('dataTexture' as never),
          resolution: regl.prop('resolution' as never),
          mouse: regl.prop('mouse' as never),
          mouseDown: regl.prop('mouseDown' as never),
          time: regl.prop('time' as never),
          dt: regl.prop('dt' as never),
        },
        framebuffer: regl.prop('framebuffer' as never),
        count: 6,
        depth: { enable: false },
      }) as unknown as (props: Record<string, unknown>) => void;
    },
    draw(state: UniformState) {
      drawSim({
        previousFrame: resources.pingPong.read,
        dataTexture: resources.dataTexture,
        resolution: state.resolution,
        mouse: state.mouse,
        mouseDown: state.mouseDown,
        time: state.time,
        dt: state.dt,
        framebuffer: resources.pingPong.write,
      });
      resources.pingPong.swap();
    },
  };
}
