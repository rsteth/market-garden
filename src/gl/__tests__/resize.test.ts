import { computeCanvasSize, applyCanvasSize } from '../resize';

// ---- mock window.devicePixelRatio ----

const originalDPR = globalThis.window?.devicePixelRatio;

function mockCanvas(clientW: number, clientH: number, w = 0, h = 0) {
  return { clientWidth: clientW, clientHeight: clientH, width: w, height: h } as unknown as HTMLCanvasElement;
}

beforeAll(() => {
  // minimal window shim for JSDOM-less environment
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {};
  }
});

afterAll(() => {
  if (originalDPR !== undefined) {
    Object.defineProperty(window, 'devicePixelRatio', { value: originalDPR, configurable: true });
  }
});

function setDPR(v: number) {
  Object.defineProperty(window, 'devicePixelRatio', { value: v, configurable: true });
}

// ---- computeCanvasSize ----

describe('computeCanvasSize', () => {
  it('returns floor-rounded dimensions at 1x DPR', () => {
    setDPR(1);
    const size = computeCanvasSize(mockCanvas(800, 600));
    expect(size.width).toBe(800);
    expect(size.height).toBe(600);
    expect(size.pixelRatio).toBe(1);
  });

  it('doubles dimensions at 2x DPR', () => {
    setDPR(2);
    const size = computeCanvasSize(mockCanvas(400, 300));
    expect(size.width).toBe(800);
    expect(size.height).toBe(600);
    expect(size.pixelRatio).toBe(2);
  });

  it('caps DPR at 2 when device reports 3x', () => {
    setDPR(3);
    const size = computeCanvasSize(mockCanvas(400, 300));
    expect(size.width).toBe(800);
    expect(size.height).toBe(600);
    expect(size.pixelRatio).toBe(2);
  });

  it('floors fractional dimensions', () => {
    setDPR(1.5);
    // 333 * 1.5 = 499.5 → 499
    const size = computeCanvasSize(mockCanvas(333, 222));
    expect(size.width).toBe(Math.floor(333 * 1.5));
    expect(size.height).toBe(Math.floor(222 * 1.5));
  });

  it('treats missing DPR as 1', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: undefined, configurable: true });
    const size = computeCanvasSize(mockCanvas(640, 480));
    expect(size.pixelRatio).toBe(1);
    expect(size.width).toBe(640);
    expect(size.height).toBe(480);
  });
});

// ---- applyCanvasSize ----

describe('applyCanvasSize', () => {
  it('returns true and sets dimensions when size changes', () => {
    const canvas = mockCanvas(800, 600, 0, 0);
    const changed = applyCanvasSize(canvas, { width: 800, height: 600, pixelRatio: 1 });
    expect(changed).toBe(true);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('returns false when size is already correct', () => {
    const canvas = mockCanvas(800, 600, 800, 600);
    const changed = applyCanvasSize(canvas, { width: 800, height: 600, pixelRatio: 1 });
    expect(changed).toBe(false);
  });

  it('returns true when only width changes', () => {
    const canvas = mockCanvas(1024, 600, 800, 600);
    const changed = applyCanvasSize(canvas, { width: 1024, height: 600, pixelRatio: 1 });
    expect(changed).toBe(true);
    expect(canvas.width).toBe(1024);
  });

  it('returns true when only height changes', () => {
    const canvas = mockCanvas(800, 768, 800, 600);
    const changed = applyCanvasSize(canvas, { width: 800, height: 768, pixelRatio: 1 });
    expect(changed).toBe(true);
    expect(canvas.height).toBe(768);
  });
});
