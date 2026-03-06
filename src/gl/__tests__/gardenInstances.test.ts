import { generateInstances } from '../gardenInstances';

describe('generateInstances', () => {
  const data = generateInstances();

  // ---- counts ----

  it('defaults to 10 000 instances', () => {
    expect(data.count).toBe(10_000);
    expect(data.positions.length).toBe(10_000 * 3);
    expect(data.scales.length).toBe(10_000);
    expect(data.seeds.length).toBe(10_000);
    expect(data.kinds.length).toBe(10_000);
    expect(data.heightScales.length).toBe(10_000);
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
    const maxRadialOvershoot = gardenRadius * 0.08;
    const maxR = gardenRadius + maxRadialOvershoot + 0.001;
    for (let i = 0; i < data.count; i++) {
      const x = data.positions[i * 3];
      const z = data.positions[i * 3 + 2];
      expect(Math.sqrt(x * x + z * z)).toBeLessThanOrEqual(maxR);
    }
  });

  // ---- scale constraints ----

  it('scales are in [0.65, 1.56]', () => {
    for (let i = 0; i < data.count; i++) {
      expect(data.scales[i]).toBeGreaterThanOrEqual(0.65);
      expect(data.scales[i]).toBeLessThanOrEqual(1.56);
    }
  });

  // ---- kind / height constraints ----

  it('contains base flowers and four tall flower kinds', () => {
    const seen = new Set<number>();
    for (let i = 0; i < data.count; i++) {
      seen.add(data.kinds[i]);
      expect(data.kinds[i]).toBeGreaterThanOrEqual(0);
      expect(data.kinds[i]).toBeLessThanOrEqual(4);
      expect(data.heightScales[i]).toBeGreaterThan(0.9);
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(1)).toBe(true);
    expect(seen.has(2)).toBe(true);
    expect(seen.has(3)).toBe(true);
    expect(seen.has(4)).toBe(true);
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
    expect(data2.kinds[9999]).toBe(data.kinds[9999]);
  });

  // ---- distribution ----

  it('first base instance is near the center (Fibonacci spiral)', () => {
    const x = data.positions[0];
    const z = data.positions[2];
    expect(Math.sqrt(x * x + z * z)).toBeLessThan(2);
  });

  it('tall flowers remain region-clustered but spread farther from cluster centers', () => {
    const tallIndices: number[] = [];
    for (let i = 0; i < data.count; i++) {
      if (data.kinds[i] > 0.5) tallIndices.push(i);
    }

    expect(tallIndices.length).toBeGreaterThan(1000);

    const regionCenters: [number, number][] = Array.from({ length: 7 }, (_, i) => {
      const angle = i * ((Math.PI * 2) / 7) + 0.3;
      const radius = (11 + 2 * Math.sin(i * 1.7)) * 1.2;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });

    let nearRing = 0;
    let meanNearestRegionDist = 0;
    for (const i of tallIndices) {
      const x = data.positions[i * 3];
      const z = data.positions[i * 3 + 2];

      const radial = Math.hypot(x, z);
      if (radial > 7 && radial < 20) nearRing++;

      let nearest = Number.POSITIVE_INFINITY;
      for (const [cx, cz] of regionCenters) {
        nearest = Math.min(nearest, Math.hypot(x - cx, z - cz));
      }
      meanNearestRegionDist += nearest;
    }

    meanNearestRegionDist /= tallIndices.length;

    expect(nearRing / tallIndices.length).toBeGreaterThan(0.7);
    expect(meanNearestRegionDist).toBeGreaterThan(2.2);
    expect(meanNearestRegionDist).toBeLessThan(5.8);
  });
});
