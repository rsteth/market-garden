/**
 * Bulletproof render-target ladder for WebGL2 + regl.
 *
 * regl gates `type: 'float'` behind the WebGL1 OES_texture_float extension
 * string, which WebGL2 contexts don't expose. We work around this by creating
 * textures as uint8 through regl, then reinitializing the backing store to a
 * float format via raw GL calls.
 */

import type REGL from 'regl';

// ---- types ----

export type RtType = 'float' | 'half-float' | 'uint8';

export interface RenderTarget {
  fbo: REGL.Framebuffer2D;
  colorTex: REGL.Texture2D;
  type: RtType;
  resize(width: number, height: number): void;
  destroy(): void;
}

// ---- raw GL reinit ----

/**
 * Replace a regl-managed texture's backing store with a float-format image
 * via raw GL calls. This sidesteps regl's extension gating entirely.
 */
function reinitTextureAsFloat(
  gl: WebGL2RenderingContext,
  texture: REGL.Texture2D,
  width: number,
  height: number,
  internalFormat: number,
  glType: number,
  filter: number,
): void {
  // regl textures expose their GL handle as _texture.texture
  const glTex = (texture as unknown as { _texture: { texture: WebGLTexture } })
    ._texture.texture;

  gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, internalFormat,
    width, height, 0,
    gl.RGBA, glType, null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
}

// ---- public API ----

/**
 * Create a float texture (not FBO-attached) for data uploads.
 * Uses regl to allocate a uint8 texture, then reinits to RGBA32F via raw GL.
 */
export function createFloatTexture(
  regl: REGL.Regl,
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  data?: Float32Array,
): REGL.Texture2D {
  const texture = regl.texture({
    width,
    height,
    type: 'uint8',
    format: 'rgba',
    min: 'nearest',
    mag: 'nearest',
    wrap: 'clamp',
  });

  const glTex = (texture as unknown as { _texture: { texture: WebGLTexture } })
    ._texture.texture;

  gl.bindTexture(gl.TEXTURE_2D, glTex);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA32F,
    width, height, 0,
    gl.RGBA, gl.FLOAT, data ?? null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
}

/**
 * Create a render target (FBO + color attachment) with automatic format ladder:
 *   1. RGBA32F  (requires EXT_color_buffer_float)
 *   2. RGBA16F  (probe framebuffer completeness)
 *   3. uint8    (always works)
 *
 * For float/half-float, we create the texture as uint8 through regl then
 * reinit the backing store via raw GL, bypassing regl's extension checks.
 */
export function createRenderTarget(
  regl: REGL.Regl,
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  opts: {
    depth?: boolean;
    filter?: 'nearest' | 'linear';
    preferredType?: RtType;
  } = {},
): RenderTarget {
  const { depth = false, filter = 'linear', preferredType } = opts;
  const glFilter = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;

  // Determine best available type
  const type = preferredType ?? probeRenderTargetType(gl);

  // Create texture as uint8 via regl (always safe)
  const colorTex = regl.texture({
    width,
    height,
    type: 'uint8',
    format: 'rgba',
    min: filter,
    mag: filter,
    wrap: 'clamp',
  });

  // Reinit to float format if possible
  if (type === 'float') {
    reinitTextureAsFloat(gl, colorTex, width, height, gl.RGBA32F, gl.FLOAT, glFilter);
  } else if (type === 'half-float') {
    reinitTextureAsFloat(gl, colorTex, width, height, gl.RGBA16F, gl.HALF_FLOAT, glFilter);
  }

  // Create FBO with the (now-reinited) texture
  const fbo = regl.framebuffer({
    width,
    height,
    color: colorTex,
    depth,
    depthStencil: false,
  });

  return {
    fbo,
    colorTex,
    type,
    resize(w: number, h: number) {
      // Resize the uint8 shell through regl first (updates regl internal tracking)
      fbo.resize(w, h);
      // Then reinit the backing store to float again
      if (type === 'float') {
        reinitTextureAsFloat(gl, colorTex, w, h, gl.RGBA32F, gl.FLOAT, glFilter);
      } else if (type === 'half-float') {
        reinitTextureAsFloat(gl, colorTex, w, h, gl.RGBA16F, gl.HALF_FLOAT, glFilter);
      }
    },
    destroy() {
      fbo.destroy();
    },
  };
}

// ---- format probing ----

let cachedType: RtType | null = null;

function probeRenderTargetType(gl: WebGL2RenderingContext): RtType {
  if (cachedType !== null) return cachedType;

  // Try RGBA32F (requires EXT_color_buffer_float)
  if (gl.getExtension('EXT_color_buffer_float')) {
    if (probeFormat(gl, gl.RGBA32F, gl.FLOAT)) {
      cachedType = 'float';
      return cachedType;
    }
  }

  // Try RGBA16F
  if (probeFormat(gl, gl.RGBA16F, gl.HALF_FLOAT)) {
    cachedType = 'half-float';
    return cachedType;
  }

  cachedType = 'uint8';
  return cachedType;
}

function probeFormat(
  gl: WebGL2RenderingContext,
  internalFormat: number,
  type: number,
): boolean {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 1, 1, 0, gl.RGBA, type, null);

  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb);
  gl.deleteTexture(tex);

  return ok;
}
