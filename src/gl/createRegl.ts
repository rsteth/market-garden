import type REGL from 'regl';
import { tryGetWebGL2 } from './capabilities';

export interface ReglSetup {
  regl: REGL.Regl;
  gl: WebGL2RenderingContext;
}

/**
 * Create a regl instance backed by a WebGL2 context.
 * Uses dynamic import so the regl module is never evaluated during SSR.
 *
 * Float textures are handled via the renderTarget module's raw-GL reinit
 * trick, so we do NOT require any float extensions through regl.
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

  // Pre-warm extensions so the browser caches them before regl probes
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear');
  gl.getExtension('OES_texture_half_float_linear');

  // Shim ANGLE_instanced_arrays for regl on WebGL2.
  // WebGL2 has instancing natively, but regl gates on this extension.
  const origGetExt = gl.getExtension.bind(gl);
  gl.getExtension = function (name: string) {
    if (name.toLowerCase() === 'angle_instanced_arrays') {
      return {
        drawArraysInstancedANGLE: gl.drawArraysInstanced.bind(gl),
        drawElementsInstancedANGLE: gl.drawElementsInstanced.bind(gl),
        vertexAttribDivisorANGLE: gl.vertexAttribDivisor.bind(gl),
        VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE: 0x88fe,
      };
    }
    return origGetExt(name);
  } as typeof gl.getExtension;

  const regl = createREGL({
    gl,
    optionalExtensions: [
      'ANGLE_instanced_arrays',
      'OES_texture_float',
      'OES_texture_half_float',
      'EXT_color_buffer_float',
      'EXT_color_buffer_half_float',
      'OES_texture_float_linear',
      'OES_texture_half_float_linear',
    ],
  });

  return { regl, gl };
}
