import type { RenderResources, Pass } from './types';
import type { UniformState } from '../uniformBus';
import fullscreenVert from '../shaders/fullscreen.vert';
import compositeFrag from '../shaders/composite.frag';

const FULLSCREEN_QUAD: [number, number][] = [
  [-1, -1], [1, -1], [-1, 1],
  [-1, 1],  [1, -1], [1,  1],
];

/**
 * Composite pass — reads the sim output and tone-maps / vignettes to screen.
 */
export function createCompositePass(): Pass {
  let drawComposite: (props: Record<string, unknown>) => void;
  let resources: RenderResources;

  return {
    name: 'composite',
    init(regl, res) {
      resources = res;

      drawComposite = regl({
        vert: fullscreenVert,
        frag: compositeFrag,
        attributes: { position: FULLSCREEN_QUAD },
        uniforms: {
          source: regl.prop('source' as never),
          dataTexture: regl.prop('dataTexture' as never),
          resolution: regl.prop('resolution' as never),
          time: regl.prop('time' as never),
        },
        count: 6,
        depth: { enable: false },
      }) as unknown as (props: Record<string, unknown>) => void;
    },
    draw(state: UniformState) {
      drawComposite({
        source: resources.pingPong.read,
        dataTexture: resources.dataTexture,
        resolution: state.resolution,
        time: state.time,
      });
    },
  };
}
