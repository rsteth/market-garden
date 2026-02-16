import { generateFlowerMesh, type FlowerMesh } from '../meshFlower';

let mesh: FlowerMesh;

beforeAll(() => {
  mesh = generateFlowerMesh();
});

describe('generateFlowerMesh', () => {
  // ---- structural integrity ----

  it('returns non-empty mesh', () => {
    expect(mesh.vertexCount).toBeGreaterThan(0);
    expect(mesh.indexCount).toBeGreaterThan(0);
  });

  it('array lengths are consistent with vertex/index counts', () => {
    expect(mesh.positions.length).toBe(mesh.vertexCount * 3);
    expect(mesh.normals.length).toBe(mesh.vertexCount * 3);
    expect(mesh.partIds.length).toBe(mesh.vertexCount);
    expect(mesh.uAlongs.length).toBe(mesh.vertexCount);
    expect(mesh.uRadials.length).toBe(mesh.vertexCount);
    expect(mesh.indices.length).toBe(mesh.indexCount);
  });

  it('all indices are within vertex bounds', () => {
    for (let i = 0; i < mesh.indexCount; i++) {
      expect(mesh.indices[i]).toBeGreaterThanOrEqual(0);
      expect(mesh.indices[i]).toBeLessThan(mesh.vertexCount);
    }
  });

  it('index count is a multiple of 3 (triangles)', () => {
    expect(mesh.indexCount % 3).toBe(0);
  });

  // ---- partId correctness ----

  it('partIds are only 0, 1, or 2', () => {
    const unique = new Set<number>();
    for (let i = 0; i < mesh.vertexCount; i++) {
      unique.add(mesh.partIds[i]);
    }
    expect(unique).toEqual(new Set([0, 1, 2]));
  });

  it('has vertices for all three parts (stalk, head, petals)', () => {
    let stalk = 0, head = 0, petal = 0;
    for (let i = 0; i < mesh.vertexCount; i++) {
      if (mesh.partIds[i] === 0) stalk++;
      else if (mesh.partIds[i] === 1) head++;
      else petal++;
    }
    expect(stalk).toBeGreaterThan(0);
    expect(head).toBeGreaterThan(0);
    expect(petal).toBeGreaterThan(0);
  });

  // ---- parametric attributes ----

  it('uAlongs are in [0, 1]', () => {
    for (let i = 0; i < mesh.vertexCount; i++) {
      expect(mesh.uAlongs[i]).toBeGreaterThanOrEqual(0);
      expect(mesh.uAlongs[i]).toBeLessThanOrEqual(1);
    }
  });

  it('uRadials are in [0, 1)', () => {
    for (let i = 0; i < mesh.vertexCount; i++) {
      expect(mesh.uRadials[i]).toBeGreaterThanOrEqual(0);
      expect(mesh.uRadials[i]).toBeLessThanOrEqual(1);
    }
  });

  // ---- normals ----

  it('normals are approximately unit length', () => {
    let maxDeviation = 0;
    for (let i = 0; i < mesh.vertexCount; i++) {
      const nx = mesh.normals[i * 3];
      const ny = mesh.normals[i * 3 + 1];
      const nz = mesh.normals[i * 3 + 2];
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      maxDeviation = Math.max(maxDeviation, Math.abs(len - 1));
    }
    expect(maxDeviation).toBeLessThan(0.01);
  });

  // ---- no degenerate triangles ----

  it('has no degenerate triangles (duplicate vertex indices)', () => {
    let degenerateCount = 0;
    for (let i = 0; i < mesh.indexCount; i += 3) {
      const a = mesh.indices[i], b = mesh.indices[i + 1], c = mesh.indices[i + 2];
      if (a === b || b === c || a === c) degenerateCount++;
    }
    expect(degenerateCount).toBe(0);
  });

  // ---- determinism ----

  it('produces identical output on repeated calls', () => {
    const mesh2 = generateFlowerMesh();
    expect(mesh2.vertexCount).toBe(mesh.vertexCount);
    expect(mesh2.indexCount).toBe(mesh.indexCount);
    // spot-check a few positions
    for (let i = 0; i < 30; i++) {
      expect(mesh2.positions[i]).toBe(mesh.positions[i]);
    }
  });
});
