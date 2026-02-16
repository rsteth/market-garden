export interface CanvasSize {
  width: number;
  height: number;
  pixelRatio: number;
}

/** Compute the backing-store size for a canvas, respecting DPR (capped at 2x). */
export function computeCanvasSize(canvas: HTMLCanvasElement): CanvasSize {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.floor(canvas.clientWidth * pixelRatio);
  const height = Math.floor(canvas.clientHeight * pixelRatio);
  return { width, height, pixelRatio };
}

/**
 * Apply a computed size to a canvas element.
 * Returns true when the size actually changed (so callers know to resize FBOs).
 */
export function applyCanvasSize(
  canvas: HTMLCanvasElement,
  size: CanvasSize,
): boolean {
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
    return true;
  }
  return false;
}
