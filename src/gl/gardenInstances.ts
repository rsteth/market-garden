/**
 * Generate instance data for the flower garden.
 * Base flowers keep the existing Fibonacci-spiral distribution.
 * Tall accent flowers are generated in procedural bunches around region control points.
 */

export interface InstanceData {
  positions: Float32Array;   // vec3 per instance (x, y=0, z)
  scales: Float32Array;      // float per instance
  seeds: Float32Array;       // float per instance
  kinds: Float32Array;       // 0 = base flower, 1..N = tall flower variant
  heightScales: Float32Array;// per-instance height multiplier
  count: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const EDGE_FALLOFF_POWER = 0.62;
const EDGE_BAND_START = 0.3;
const BASE_FLOWER_SHARE = 0.82;
const PI2 = Math.PI * 2;

const TALL_FLOWER_HEIGHTS = [1.55, 1.9, 1.7, 1.8] as const;
const TALL_CLUSTER_SIGMA = 2.8;
const TALL_CLUSTER_NOISE = 0.34;
const TALL_CLUSTER_OUTWARD_PUSH = 1.7;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function getRegionCenter(i: number): [number, number] {
  const angle = i * (PI2 / 7) + 0.3;
  const radius = (11 + 2 * Math.sin(i * 1.7)) * 1.2;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

export function generateInstances(
  count: number = 10000,
  gardenRadius: number = 22,
): InstanceData {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const seeds = new Float32Array(count);
  const kinds = new Float32Array(count);
  const heightScales = new Float32Array(count);

  // seeded LCG for deterministic placement
  let rngState = 12345;
  const rng = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };

  const baseCount = Math.max(0, Math.min(count, Math.floor(count * BASE_FLOWER_SHARE)));
  const regionCenters = new Array<[number, number]>(7).fill([0, 0]).map((_, i) => getRegionCenter(i));

  // Existing flower field: unchanged Fibonacci spiral look.
  for (let i = 0; i < baseCount; i++) {
    const t = i / Math.max(1, baseCount);
    const baseR = Math.pow(t, EDGE_FALLOFF_POWER) * gardenRadius;
    const edgeT = smoothstep(EDGE_BAND_START, 1, t);
    const edgeJitter = (rng() - 0.5) * gardenRadius * 0.4 * edgeT;
    const r = Math.max(0, Math.min(gardenRadius * 1.06, baseR + edgeJitter));
    const theta = i * GOLDEN_ANGLE;

    positions[i * 3] = Math.cos(theta) * r + (rng() - 0.5) * 0.35;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(theta) * r + (rng() - 0.5) * 0.35;

    scales[i] = 0.65 + rng() * 0.7;
    seeds[i] = rng();
    kinds[i] = 0;
    heightScales[i] = 1;
  }

  // New tall flowers: clustered around local control regions.
  for (let i = baseCount; i < count; i++) {
    const idx = i - baseCount;
    const regionIdx = idx % regionCenters.length;
    const [cx, cz] = regionCenters[regionIdx];

    // Gaussian radial sample with a wider spread and directional push away from each center.
    const u1 = Math.max(0.0001, rng());
    const u2 = rng();
    const radial = Math.sqrt(-2 * Math.log(u1)) * TALL_CLUSTER_SIGMA;
    const theta = u2 * PI2;

    const centerLen = Math.max(0.001, Math.hypot(cx, cz));
    const dirX = cx / centerLen;
    const dirZ = cz / centerLen;
    const outwardBias = Math.pow(rng(), 1.4) * TALL_CLUSTER_OUTWARD_PUSH;

    let x = cx + Math.cos(theta) * radial + dirX * outwardBias + (rng() - 0.5) * TALL_CLUSTER_NOISE;
    let z = cz + Math.sin(theta) * radial + dirZ * outwardBias + (rng() - 0.5) * TALL_CLUSTER_NOISE;

    const dist = Math.hypot(x, z);
    const maxDist = gardenRadius * 1.08;
    if (dist > maxDist) {
      const clampT = maxDist / dist;
      x *= clampT;
      z *= clampT;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = z;

    const tallKind = 1 + Math.floor(rng() * TALL_FLOWER_HEIGHTS.length);
    kinds[i] = tallKind;
    heightScales[i] = TALL_FLOWER_HEIGHTS[tallKind - 1] + (rng() - 0.5) * 0.14;
    scales[i] = 0.68 + rng() * 0.88;
    seeds[i] = rng();
  }

  return { positions, scales, seeds, kinds, heightScales, count };
}
