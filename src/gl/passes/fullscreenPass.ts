import type { RenderResources, Pass } from './types';
import type { UniformState } from '../uniformBus';
import fullscreenVert from '../shaders/fullscreen.vert';

const BLIT_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D source;
void main() {
  gl_FragColor = texture2D(source, vUv);
}
`;

const FULLSCREEN_QUAD: [number, number][] = [
  [-1, -1], [1, -1], [-1, 1],
  [-1, 1],  [1, -1], [1,  1],
];

/**
 * Minimal fullscreen blit — draws a texture to the current render target
 * (usually the screen) with no processing.
 */
export function createFullscreenPass(): Pass {
  let drawBlit: (props: Record<string, unknown>) => void;
  let resources: RenderResources;

  return {
    name: 'fullscreen',
    init(regl, res) {
      resources = res;
      drawBlit = regl({
        vert: fullscreenVert,
        frag: BLIT_FRAG,
        attributes: { position: FULLSCREEN_QUAD },
        uniforms: {
          source: regl.prop('source' as never),
        },
        count: 6,
        depth: { enable: false },
      }) as unknown as (props: Record<string, unknown>) => void;
    },
    draw(_state: UniformState) {
      drawBlit({ source: resources.pingPong.read });
    },
  };
}
