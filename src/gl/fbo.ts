import type REGL from 'regl';
import { createRenderTarget } from './renderTarget';
import type { RenderTarget } from './renderTarget';

export interface PingPongFBO {
  readonly read: REGL.Framebuffer2D;
  readonly write: REGL.Framebuffer2D;
  swap(): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export function createPingPongFBO(
  regl: REGL.Regl,
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
): PingPongFBO {
  const rts: [RenderTarget, RenderTarget] = [
    createRenderTarget(regl, gl, width, height),
    createRenderTarget(regl, gl, width, height),
  ];
  let index = 0;

  return {
    get read() {
      return rts[index].fbo;
    },
    get write() {
      return rts[1 - index].fbo;
    },
    swap() {
      index = 1 - index;
    },
    resize(w, h) {
      rts[0].resize(w, h);
      rts[1].resize(w, h);
    },
    destroy() {
      rts[0].destroy();
      rts[1].destroy();
    },
  };
}

export function createColorFBO(
  regl: REGL.Regl,
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  opts?: { depth?: boolean; filter?: 'nearest' | 'linear' },
): RenderTarget {
  return createRenderTarget(regl, gl, width, height, opts);
}
