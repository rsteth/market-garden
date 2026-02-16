/**
 * Generate instance data for the flower garden.
 * Uses a Fibonacci-spiral distribution for a natural look.
 */

export interface InstanceData {
  positions: Float32Array;   // vec3 per instance (x, y=0, z)
  scales: Float32Array;      // float per instance
  seeds: Float32Array;       // float per instance
  count: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function generateInstances(
  count: number = 10000,
  gardenRadius: number = 22,
): InstanceData {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const seeds = new Float32Array(count);

  // seeded LCG for deterministic placement
  let rngState = 12345;
  const rng = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const r = Math.sqrt(t) * gardenRadius;
    const theta = i * GOLDEN_ANGLE;

    positions[i * 3]     = Math.cos(theta) * r + (rng() - 0.5) * 0.35;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(theta) * r + (rng() - 0.5) * 0.35;

    scales[i] = 0.65 + rng() * 0.7;
    seeds[i] = rng();
  }

  return { positions, scales, seeds, count };
}
