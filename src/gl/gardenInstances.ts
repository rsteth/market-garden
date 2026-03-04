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
const EDGE_FALLOFF_POWER = 0.62;
const EDGE_BAND_START = 0.3;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

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
    const baseR = Math.pow(t, EDGE_FALLOFF_POWER) * gardenRadius;
    const edgeT = smoothstep(EDGE_BAND_START, 1, t);
    const edgeJitter = (rng() - 0.5) * gardenRadius * 0.4 * edgeT;
    const r = Math.max(0, Math.min(gardenRadius * 1.06, baseR + edgeJitter));
    const theta = i * GOLDEN_ANGLE;

    positions[i * 3]     = Math.cos(theta) * r + (rng() - 0.5) * 0.35;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(theta) * r + (rng() - 0.5) * 0.35;

    scales[i] = 0.65 + rng() * 0.7;
    seeds[i] = rng();
  }

  return { positions, scales, seeds, count };
}
