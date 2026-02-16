import type REGL from 'regl';
import type { RenderResources } from '@/gl/passes/types';
import type { UniformState } from '@/gl/uniformBus';
import type { Scene } from './types';
import { createSimPass } from '@/gl/passes/simPass';
import { createCompositePass } from '@/gl/passes/compositePass';
import { createFullscreenPass } from '@/gl/passes/fullscreenPass';

/**
 * Smoke-test scene:
 *   Pass A ("sim")       — feedback simulation into a ping-pong FBO
 *   Pass B ("composite") — tone-maps the sim output to screen
 *
 * When "composite" is toggled off the raw sim buffer is blitted instead.
 */
export function createSmokeTestScene(): Scene {
  const simPass = createSimPass();
  const compositePass = createCompositePass();
  const blitPass = createFullscreenPass(); // fallback when composite is off

  return {
    name: 'smokeTest',
    passNames: ['sim', 'composite'],

    init(regl, resources) {
      simPass.init(regl, resources);
      compositePass.init(regl, resources);
      blitPass.init(regl, resources);
    },

    update(_state) {
      // Reserved for future per-frame scene logic (e.g. data-driven animation).
    },

    draw(state, activePasses) {
      if (activePasses.has('sim')) {
        simPass.draw(state);
      }

      if (activePasses.has('composite')) {
        compositePass.draw(state);
      } else {
        // Show the raw sim FBO without post-processing
        blitPass.draw(state);
      }
    },

    destroy() {
      simPass.destroy?.();
      compositePass.destroy?.();
      blitPass.destroy?.();
    },
  };
}
