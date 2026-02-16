import type REGL from 'regl';
import type { PingPongFBO } from '../fbo';
import type { CapabilityPlan } from '../capabilities';
import type { UniformState } from '../uniformBus';

/** GPU resources shared across all passes in a scene. */
export interface RenderResources {
  pingPong: PingPongFBO;
  /** Placeholder data texture — currently 2x2, will become market-data texture. */
  dataTexture: REGL.Texture2D;
  capabilities: CapabilityPlan;
}

/** A single render pass. */
export interface Pass {
  readonly name: string;
  init(regl: REGL.Regl, resources: RenderResources): void;
  draw(state: UniformState): void;
  resize?(width: number, height: number): void;
  destroy?(): void;
}
