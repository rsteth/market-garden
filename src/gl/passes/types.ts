import type REGL from 'regl';
import type { PingPongFBO } from '../fbo';
import type { CapabilityPlan } from '../capabilities';
import type { UniformState } from '../uniformBus';

/** GPU resources shared across all passes in a scene. */
export interface RenderResources {
  gl: WebGL2RenderingContext;
  pingPong: PingPongFBO;
  /** Data texture — 2x8 RGBA32F for market data. */
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
