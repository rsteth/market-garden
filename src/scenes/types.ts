import type REGL from 'regl';
import type { RenderResources } from '@/gl/passes/types';
import type { UniformState } from '@/gl/uniformBus';

export interface Scene {
  readonly name: string;
  /** Names of passes this scene uses (for the debug overlay toggle list). */
  readonly passNames: string[];
  init(regl: REGL.Regl, resources: RenderResources): void;
  update(state: UniformState): void;
  /**
   * Draw the scene.  `activePasses` controls which passes actually execute
   * (driven by the debug overlay toggles).
   */
  draw(state: UniformState, activePasses: Set<string>): void;
  destroy?(): void;
}
