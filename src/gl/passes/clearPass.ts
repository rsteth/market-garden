import type REGL from 'regl';
import type { Pass } from './types';
import type { UniformState } from '../uniformBus';

export function createClearPass(): Pass {
  let reglInstance: REGL.Regl;

  return {
    name: 'clear',
    init(regl) {
      reglInstance = regl;
    },
    draw(_state: UniformState) {
      reglInstance.clear({ color: [0, 0, 0, 1], depth: 1 });
    },
  };
}
