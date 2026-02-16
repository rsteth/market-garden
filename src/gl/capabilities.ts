export interface CapabilityPlan {
  webgl2: boolean;
  floatTextures: boolean;
  floatRenderTarget: boolean;
  floatLinearFilter: boolean;
  halfFloatFallback: boolean;
  textureType: 'float' | 'half float' | 'uint8';
  maxTextureSize: number;
}

/**
 * Attempt to acquire a WebGL2 context with performance-oriented attributes.
 * Returns null when WebGL2 is unavailable.
 */
export function tryGetWebGL2(
  canvas: HTMLCanvasElement,
): WebGL2RenderingContext | null {
  const attributes: WebGLContextAttributes = {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  };
  return canvas.getContext('webgl2', attributes) as WebGL2RenderingContext | null;
}

/**
 * Bulletproof capability ladder:
 *   1. float  render-targets  (EXT_color_buffer_float)
 *   2. half-float render-targets (manual framebuffer probe)
 *   3. uint8 fallback
 */
export function checkCapabilities(
  gl: WebGL2RenderingContext,
): CapabilityPlan {
  // WebGL2 always supports float textures for sampling
  const floatTextures = true;

  // Full float render targets
  const extColorBufferFloat = gl.getExtension('EXT_color_buffer_float');
  const floatRenderTarget = !!extColorBufferFloat;

  // Linear filtering of float textures
  const extFloatLinear = gl.getExtension('OES_texture_float_linear');
  const floatLinearFilter = !!extFloatLinear;

  // Decide texture type plan
  let textureType: CapabilityPlan['textureType'];
  let halfFloatFallback = false;

  if (floatRenderTarget) {
    textureType = 'float';
  } else {
    halfFloatFallback = probeHalfFloatFramebuffer(gl);
    textureType = halfFloatFallback ? 'half float' : 'uint8';
  }

  return {
    webgl2: true,
    floatTextures,
    floatRenderTarget,
    floatLinearFilter,
    halfFloatFallback,
    textureType,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
  };
}

/** Try creating a RGBA16F framebuffer to see if half-float render targets work. */
function probeHalfFloatFramebuffer(gl: WebGL2RenderingContext): boolean {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA16F,
    1, 1, 0,
    gl.RGBA, gl.HALF_FLOAT, null,
  );

  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D, texture, 0,
  );

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fb);
  gl.deleteTexture(texture);

  return status === gl.FRAMEBUFFER_COMPLETE;
}
