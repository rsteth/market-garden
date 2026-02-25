/**
 * Procedural flower mesh — stalk + head + petals.
 * Vertex attributes: position, normal, partId, uAlong, uRadial.
 */

const STALK_HEIGHT = 1.0;
const STALK_BASE_R = 0.018;
const STALK_TOP_R = 0.008;
const STALK_SEGS = 6;
const STALK_SIDES = 5;

const HEAD_R = 0.045;
const HEAD_Y = STALK_HEIGHT;
const HEAD_LONS = 6;
const HEAD_LATS = 2;

const N_PETALS = 5;
const PETAL_LEN = 0.12;
const PETAL_W = 0.045;
const PETAL_SEGS_ALONG = 3;
const PETAL_SEGS_ACROSS = 1;

export interface FlowerMesh {
  positions: Float32Array;
  normals: Float32Array;
  partIds: Float32Array;
  uAlongs: Float32Array;
  uRadials: Float32Array;
  indices: Uint16Array;
  vertexCount: number;
  indexCount: number;
}

export function generateFlowerMesh(): FlowerMesh {
  const pos: number[] = [];
  const nrm: number[] = [];
  const pid: number[] = [];
  const ual: number[] = [];
  const urd: number[] = [];
  const idx: number[] = [];

  let baseVertex = 0;

  // ---- STALK (partId 0) ----
  for (let seg = 0; seg <= STALK_SEGS; seg++) {
    const t = seg / STALK_SEGS;
    const y = t * STALK_HEIGHT;
    const r = STALK_BASE_R + (STALK_TOP_R - STALK_BASE_R) * t;
    for (let s = 0; s < STALK_SIDES; s++) {
      const angle = (s / STALK_SIDES) * Math.PI * 2;
      pos.push(Math.cos(angle) * r, y, Math.sin(angle) * r);
      nrm.push(Math.cos(angle), 0, Math.sin(angle));
      pid.push(0);
      ual.push(t);
      urd.push(s / STALK_SIDES);
    }
  }
  for (let seg = 0; seg < STALK_SEGS; seg++) {
    for (let s = 0; s < STALK_SIDES; s++) {
      const a = baseVertex + seg * STALK_SIDES + s;
      const b = baseVertex + seg * STALK_SIDES + (s + 1) % STALK_SIDES;
      const c = baseVertex + (seg + 1) * STALK_SIDES + s;
      const d = baseVertex + (seg + 1) * STALK_SIDES + (s + 1) % STALK_SIDES;
      idx.push(a, c, b, b, c, d);
    }
  }
  baseVertex = pos.length / 3;

  // ---- HEAD / CALYX (partId 1) ----
  // hemisphere rings
  for (let lat = 0; lat <= HEAD_LATS; lat++) {
    const phi = (lat / HEAD_LATS) * Math.PI * 0.5;
    const ringR = Math.cos(phi) * HEAD_R;
    const ringY = HEAD_Y + Math.sin(phi) * HEAD_R;
    for (let lon = 0; lon < HEAD_LONS; lon++) {
      const theta = (lon / HEAD_LONS) * Math.PI * 2;
      pos.push(Math.cos(theta) * ringR, ringY, Math.sin(theta) * ringR);
      nrm.push(
        Math.cos(theta) * Math.cos(phi),
        Math.sin(phi),
        Math.sin(theta) * Math.cos(phi),
      );
      pid.push(1);
      ual.push(phi / (Math.PI * 0.5));
      urd.push(lon / HEAD_LONS);
    }
  }
  // top vertex
  const topIdx = pos.length / 3;
  pos.push(0, HEAD_Y + HEAD_R, 0);
  nrm.push(0, 1, 0);
  pid.push(1);
  ual.push(1);
  urd.push(0);

  // indices: rings
  for (let lat = 0; lat < HEAD_LATS; lat++) {
    for (let lon = 0; lon < HEAD_LONS; lon++) {
      const a = baseVertex + lat * HEAD_LONS + lon;
      const b = baseVertex + lat * HEAD_LONS + (lon + 1) % HEAD_LONS;
      const c = baseVertex + (lat + 1) * HEAD_LONS + lon;
      const d = baseVertex + (lat + 1) * HEAD_LONS + (lon + 1) % HEAD_LONS;
      idx.push(a, c, b, b, c, d);
    }
  }
  // cap triangles
  const lastRingStart = baseVertex + HEAD_LATS * HEAD_LONS;
  for (let lon = 0; lon < HEAD_LONS; lon++) {
    idx.push(
      lastRingStart + lon,
      topIdx,
      lastRingStart + (lon + 1) % HEAD_LONS,
    );
  }
  baseVertex = pos.length / 3;

  // ---- PETALS (partId 2) ----
  const petalStartR = HEAD_R * 0.65;
  const colsPerPetal = PETAL_SEGS_ACROSS + 1;
  const rowsPerPetal = PETAL_SEGS_ALONG + 1;

  for (let p = 0; p < N_PETALS; p++) {
    const petalAngle = (p / N_PETALS) * Math.PI * 2;
    const dirX = Math.cos(petalAngle);
    const dirZ = Math.sin(petalAngle);
    const perpX = -dirZ;
    const perpZ = dirX;
    const petalBase = pos.length / 3;

    for (let row = 0; row < rowsPerPetal; row++) {
      const t = row / PETAL_SEGS_ALONG;
      const r = petalStartR + t * PETAL_LEN;
      // petal widens slightly in the middle
      const widthScale = 1.0 + 0.4 * Math.sin(t * Math.PI);
      for (let col = 0; col < colsPerPetal; col++) {
        const s = (col / PETAL_SEGS_ACROSS - 0.5) * PETAL_W * widthScale;
        pos.push(
          dirX * r + perpX * s,
          HEAD_Y + HEAD_R * 0.4,
          dirZ * r + perpZ * s,
        );
        nrm.push(0, 1, 0);
        pid.push(2);
        ual.push(t);
        urd.push(p / N_PETALS);
      }
    }
    // indices
    for (let row = 0; row < PETAL_SEGS_ALONG; row++) {
      for (let col = 0; col < PETAL_SEGS_ACROSS; col++) {
        const a = petalBase + row * colsPerPetal + col;
        const b = a + 1;
        const c = a + colsPerPetal;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
  }

  return {
    positions: new Float32Array(pos),
    normals: new Float32Array(nrm),
    partIds: new Float32Array(pid),
    uAlongs: new Float32Array(ual),
    uRadials: new Float32Array(urd),
    indices: new Uint16Array(idx),
    vertexCount: pos.length / 3,
    indexCount: idx.length,
  };
}
