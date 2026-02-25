import { extractEnvironment } from '../marketData';

/** Build a 128-float data buffer with specific meta-row values. */
function makeData(overrides: {
  vix?: number; vixChg?: number; spy?: number; ndx?: number;
  open?: number; close?: number;
} = {}): Float32Array {
  const d = new Float32Array(128);
  const m = 7 * 16;
  d[m + 0] = overrides.vix   ?? 0;
  d[m + 1] = overrides.vixChg ?? 0;
  d[m + 2] = overrides.spy    ?? 0;
  d[m + 3] = overrides.ndx    ?? 0;
  d[m + 4] = overrides.open   ?? 1000;
  d[m + 5] = overrides.close  ?? 2000;
  return d;
}

describe('extractEnvironment', () => {
  // ---- clamping ----

  it('all scalar outputs are in [0, 1]', () => {
    // extreme inputs
    const data = makeData({ vix: 5, vixChg: -5, spy: -5, ndx: 5 });
    const env = extractEnvironment(data, 1500);
    for (const key of ['windStrength', 'gustiness', 'fogAmount', 'godraysIntensity', 'dayPhase'] as const) {
      expect(env[key]).toBeGreaterThanOrEqual(0);
      expect(env[key]).toBeLessThanOrEqual(1);
    }
  });

  // ---- specific mappings ----

  it('VIX=0 maps windStrength to 0.5', () => {
    const env = extractEnvironment(makeData({ vix: 0 }), 1500);
    expect(env.windStrength).toBeCloseTo(0.5);
  });

  it('VIX=1 maps windStrength to 1', () => {
    const env = extractEnvironment(makeData({ vix: 1 }), 1500);
    expect(env.windStrength).toBeCloseTo(1);
  });

  it('negative SPY increases fogAmount', () => {
    const clear = extractEnvironment(makeData({ spy: 0.5 }), 1500);
    const foggy = extractEnvironment(makeData({ spy: -0.8 }), 1500);
    expect(foggy.fogAmount).toBeGreaterThan(clear.fogAmount);
  });

  it('positive SPY keeps fog low', () => {
    const env = extractEnvironment(makeData({ spy: 1 }), 1500);
    expect(env.fogAmount).toBeLessThan(0.1);
  });

  it('NDX magnitude drives godraysIntensity', () => {
    const low  = extractEnvironment(makeData({ ndx: 0.1 }), 1500);
    const high = extractEnvironment(makeData({ ndx: 0.9 }), 1500);
    expect(high.godraysIntensity).toBeGreaterThan(low.godraysIntensity);
  });

  // ---- sun cycle ----

  it('dayPhase = 0 before session open', () => {
    const env = extractEnvironment(makeData({ open: 1000, close: 2000 }), 500);
    expect(env.dayPhase).toBe(0);
  });

  it('dayPhase = 1 after session close', () => {
    const env = extractEnvironment(makeData({ open: 1000, close: 2000 }), 3000);
    expect(env.dayPhase).toBe(1);
  });

  it('dayPhase = 0.5 at midpoint', () => {
    const env = extractEnvironment(makeData({ open: 1000, close: 2000 }), 1500);
    expect(env.dayPhase).toBeCloseTo(0.5);
  });

  it('sunHeight peaks at mid-session', () => {
    const mid = extractEnvironment(makeData({ open: 1000, close: 2000 }), 1500);
    const edge = extractEnvironment(makeData({ open: 1000, close: 2000 }), 1050);
    expect(mid.sunHeight).toBeGreaterThan(edge.sunHeight);
  });

  it('sunHeight at mid-session equals sin(π/2) ≈ 1', () => {
    const env = extractEnvironment(makeData({ open: 1000, close: 2000 }), 1500);
    expect(env.sunHeight).toBeCloseTo(1, 2);
  });

  // ---- night mode ----

  it('defaults to dayPhase 0.5 when close <= open', () => {
    const env = extractEnvironment(makeData({ open: 2000, close: 1000 }), 1500);
    expect(env.dayPhase).toBe(0.5);
  });

  // ---- sunDir normalisation ----

  it('sunDir is a unit vector', () => {
    const env = extractEnvironment(makeData(), 1500);
    const len = Math.hypot(...env.sunDir);
    expect(len).toBeCloseTo(1, 4);
  });

  it('sunDir.y is always positive (above horizon)', () => {
    for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
      const now = 1000 + phase * 1000;
      const env = extractEnvironment(makeData({ open: 1000, close: 2000 }), now);
      expect(env.sunDir[1]).toBeGreaterThan(0);
    }
  });
});
