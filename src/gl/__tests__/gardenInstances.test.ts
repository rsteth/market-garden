import { generateInstances } from '../gardenInstances';

describe('generateInstances', () => {
  const data = generateInstances();

  // ---- counts ----

  it('defaults to 10 000 instances', () => {
    expect(data.count).toBe(10_000);
    expect(data.positions.length).toBe(10_000 * 3);
    expect(data.scales.length).toBe(10_000);
    expect(data.seeds.length).toBe(10_000);
  });

  it('accepts a custom count', () => {
    const small = generateInstances(50, 5);
    expect(small.count).toBe(50);
    expect(small.positions.length).toBe(150);
  });

  // ---- position constraints ----

  it('all Y positions are 0', () => {
    for (let i = 0; i < data.count; i++) {
      expect(data.positions[i * 3 + 1]).toBe(0);
    }
  });

  it('positions are within garden radius + jitter margin', () => {
    const gardenRadius = 22;
    const maxRadialOvershoot = gardenRadius * 0.06; // r is clamped to 106% of radius
    const maxCartesianJitter = Math.hypot(0.175, 0.175); // x/z jitter is ±0.175 each axis
    const maxR = gardenRadius + maxRadialOvershoot + maxCartesianJitter;
    for (let i = 0; i < data.count; i++) {
      const x = data.positions[i * 3];
      const z = data.positions[i * 3 + 2];
      expect(Math.sqrt(x * x + z * z)).toBeLessThanOrEqual(maxR);
    }
  });

  // ---- scale constraints ----

  it('scales are in [0.65, 1.35]', () => {
    for (let i = 0; i < data.count; i++) {
      expect(data.scales[i]).toBeGreaterThanOrEqual(0.65);
      expect(data.scales[i]).toBeLessThanOrEqual(1.35);
    }
  });

  // ---- seed constraints ----

  it('seeds are in [0, 1]', () => {
    for (let i = 0; i < data.count; i++) {
      expect(data.seeds[i]).toBeGreaterThanOrEqual(0);
      expect(data.seeds[i]).toBeLessThanOrEqual(1);
    }
  });

  // ---- determinism ----

  it('produces the same output on repeated calls', () => {
    const data2 = generateInstances();
    expect(data2.positions[0]).toBe(data.positions[0]);
    expect(data2.positions[99]).toBe(data.positions[99]);
    expect(data2.scales[500]).toBe(data.scales[500]);
    expect(data2.seeds[9999]).toBe(data.seeds[9999]);
  });

  // ---- distribution ----

  it('first instance is near the center (Fibonacci spiral)', () => {
    const x = data.positions[0];
    const z = data.positions[2];
    expect(Math.sqrt(x * x + z * z)).toBeLessThan(2);
  });

  it('last instances are near the rim', () => {
    const last = data.count - 1;
    const x = data.positions[last * 3];
    const z = data.positions[last * 3 + 2];
    expect(Math.sqrt(x * x + z * z)).toBeGreaterThan(15);
  });
});
