/**
 * Generate instance data for the flower garden.
 *
 * Existing flowers keep the original Fibonacci spiral distribution.
 * Tall flowers are generated separately and clustered around control regions.
 */

export interface InstanceData {
  positions: Float32Array;   // vec3 per instance (x, y=0, z)
  scales: Float32Array;      // float per instance
  seeds: Float32Array;       // float per instance
  species: Float32Array;     // procedural flower species id
  count: number;
}

export interface GardenInstanceGroups {
  existing: InstanceData;
  tall: InstanceData;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const EDGE_FALLOFF_POWER = 0.62;
const EDGE_BAND_START = 0.3;

const REGION_COUNT = 7;
const TALL_SPECIES_COUNT = 4;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function makeRng(seed: number): () => number {
  let rngState = seed;
  return () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };
}

function getRegionCenter(i: number): [number, number] {
  const angle = i * ((Math.PI * 2) / REGION_COUNT) + 0.3;
  const radius = (11 + 2 * Math.sin(i * 1.7)) * 1.2;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function gaussian2D(rng: () => number, sigma: number): [number, number] {
  const u1 = Math.max(1e-6, rng());
  const u2 = rng();
  const mag = sigma * Math.sqrt(-2 * Math.log(u1));
  const theta = Math.PI * 2 * u2;
  return [Math.cos(theta) * mag, Math.sin(theta) * mag];
}

export function generateExistingInstances(
  count: number = 10_000,
  gardenRadius: number = 22,
): InstanceData {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const seeds = new Float32Array(count);
  const species = new Float32Array(count);

  const rng = makeRng(12345);

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
    species[i] = 0;
  }

  return { positions, scales, seeds, species, count };
}

export function generateTallFlowerInstances(
  count: number = 1_900,
  gardenRadius: number = 22,
): InstanceData {
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const seeds = new Float32Array(count);
  const species = new Float32Array(count);

  const rng = makeRng(98765);
  const centers = Array.from({ length: REGION_COUNT }, (_, i) => getRegionCenter(i));

  for (let i = 0; i < count; i++) {
    const centerIndex = Math.floor(rng() * REGION_COUNT);
    const [cx, cz] = centers[centerIndex];
    const sigma = 1.3 + rng() * 2.5;
    const [dx, dz] = gaussian2D(rng, sigma);

    // Keep most tall flowers tightly clustered near control regions, with occasional looser outliers.
    const outlier = rng() < 0.08;
    let x = cx + dx;
    let z = cz + dz;
    if (outlier) {
      const angle = rng() * Math.PI * 2;
      const dist = (0.3 + rng() * 0.7) * gardenRadius;
      x = Math.cos(angle) * dist + (rng() - 0.5) * 0.5;
      z = Math.sin(angle) * dist + (rng() - 0.5) * 0.5;
    }

    const len = Math.hypot(x, z);
    const maxLen = gardenRadius * 1.05;
    if (len > maxLen) {
      const s = maxLen / len;
      x *= s;
      z *= s;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = z;

    scales[i] = 1.2 + rng() * 0.9;
    seeds[i] = rng();
    species[i] = Math.floor(rng() * TALL_SPECIES_COUNT);
  }

  return { positions, scales, seeds, species, count };
}

export function generateGardenInstanceGroups(
  existingCount: number = 10_000,
  tallCount: number = 1_900,
  gardenRadius: number = 22,
): GardenInstanceGroups {
  return {
    existing: generateExistingInstances(existingCount, gardenRadius),
    tall: generateTallFlowerInstances(tallCount, gardenRadius),
  };
}

// Backwards-compatible alias for existing flowers.
export function generateInstances(
  count: number = 10_000,
  gardenRadius: number = 22,
): InstanceData {
  return generateExistingInstances(count, gardenRadius);
}
