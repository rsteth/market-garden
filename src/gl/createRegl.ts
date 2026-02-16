import type REGL from 'regl';
import { tryGetWebGL2 } from './capabilities';

export interface ReglSetup {
  regl: REGL.Regl;
  gl: WebGL2RenderingContext;
}

/**
 * Create a regl instance backed by a WebGL2 context.
 * Uses dynamic import so the regl module is never evaluated during SSR.
 */
export async function initRegl(
  canvas: HTMLCanvasElement,
): Promise<ReglSetup> {
  const { default: createREGL } = await import('regl');

  const gl = tryGetWebGL2(canvas);
  if (!gl) {
    throw new Error(
      'WebGL2 is not available. Please use a modern browser with GPU support.',
    );
  }

  const regl = createREGL({
    canvas,
    gl,
    optionalExtensions: [
      'EXT_color_buffer_float',
      'OES_texture_float_linear',
      'EXT_color_buffer_half_float',
    ],
  });

  return { regl, gl };
}
