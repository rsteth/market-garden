import type REGL from 'regl';
import type { CapabilityPlan } from './capabilities';

export interface PingPongFBO {
  readonly read: REGL.Framebuffer2D;
  readonly write: REGL.Framebuffer2D;
  swap(): void;
  resize(width: number, height: number): void;
}

function reglTextureType(plan: CapabilityPlan): string {
  return plan.textureType; // 'float' | 'half float' | 'uint8' — regl accepts these directly
}

function makeFBO(
  regl: REGL.Regl,
  width: number,
  height: number,
  type: string,
): REGL.Framebuffer2D {
  return regl.framebuffer({
    width,
    height,
    color: regl.texture({
      width,
      height,
      type: type as REGL.TextureDataType,
      format: 'rgba',
      min: 'nearest',
      mag: 'nearest',
      wrap: 'clamp',
    }),
    depthStencil: false,
  });
}

export function createPingPongFBO(
  regl: REGL.Regl,
  width: number,
  height: number,
  plan: CapabilityPlan,
): PingPongFBO {
  const type = reglTextureType(plan);
  const fbos = [
    makeFBO(regl, width, height, type),
    makeFBO(regl, width, height, type),
  ];
  let index = 0;

  return {
    get read() {
      return fbos[index];
    },
    get write() {
      return fbos[1 - index];
    },
    swap() {
      index = 1 - index;
    },
    resize(w, h) {
      fbos[0].resize(w, h);
      fbos[1].resize(w, h);
    },
  };
}

export function createColorFBO(
  regl: REGL.Regl,
  width: number,
  height: number,
  plan: CapabilityPlan,
): REGL.Framebuffer2D {
  return makeFBO(regl, width, height, reglTextureType(plan));
}
