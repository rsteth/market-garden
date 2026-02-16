import { perspective, lookAt, projectDirToScreen, type Vec3 } from '../camera';

// ---- helpers ----

function dot3(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function len3(v: number[]): number {
  return Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
}

// ---- perspective ----

describe('perspective', () => {
  const fov = Math.PI / 3; // 60°
  const aspect = 16 / 9;
  const near = 0.5;
  const far = 100;
  const m = perspective(fov, aspect, near, far);

  it('returns a 16-element Float32Array', () => {
    expect(m).toBeInstanceOf(Float32Array);
    expect(m.length).toBe(16);
  });

  it('sets the focal-length diagonal correctly', () => {
    const f = 1 / Math.tan(fov / 2);
    expect(m[0]).toBeCloseTo(f / aspect, 5);
    expect(m[5]).toBeCloseTo(f, 5);
  });

  it('stores -1 in [3,2] for the perspective divide', () => {
    expect(m[11]).toBe(-1);
  });

  it('has zeros in off-diagonal positions', () => {
    // positions that must be 0 in a standard perspective matrix
    for (const i of [1, 2, 3, 4, 6, 7, 8, 9, 12, 13, 15]) {
      expect(m[i]).toBe(0);
    }
  });

  it('handles square aspect ratio', () => {
    const sq = perspective(fov, 1, near, far);
    expect(sq[0]).toBeCloseTo(sq[5], 5);
  });
});

// ---- lookAt ----

describe('lookAt', () => {
  it('produces an identity-like view when looking down -Z from origin', () => {
    const v = lookAt([0, 0, 0], [0, 0, -1], [0, 1, 0]);
    // side axis should be ~(1,0,0), up ~(0,1,0), forward ~(0,0,1)
    expect(v[0]).toBeCloseTo(1);
    expect(v[5]).toBeCloseTo(1);
    expect(v[10]).toBeCloseTo(1);
    expect(v[15]).toBeCloseTo(1);
  });

  it('produces orthonormal basis vectors (columns 0-2)', () => {
    const v = lookAt([5, 10, 15], [0, 0, 0], [0, 1, 0]);
    const side = [v[0], v[1], v[2]];
    const up   = [v[4], v[5], v[6]];
    const fwd  = [v[8], v[9], v[10]];

    // unit length
    expect(len3(side)).toBeCloseTo(1, 4);
    expect(len3(up)).toBeCloseTo(1, 4);
    expect(len3(fwd)).toBeCloseTo(1, 4);

    // mutual orthogonality
    expect(dot3(side, up)).toBeCloseTo(0, 4);
    expect(dot3(side, fwd)).toBeCloseTo(0, 4);
    expect(dot3(up, fwd)).toBeCloseTo(0, 4);
  });

  it('translation column encodes eye position', () => {
    const eye: Vec3 = [3, 4, 5];
    const v = lookAt(eye, [0, 0, 0], [0, 1, 0]);
    // v * eye should give (0,0,0,1) — i.e. eye maps to view-space origin
    const tx = v[0]*eye[0] + v[4]*eye[1] + v[8]*eye[2]  + v[12];
    const ty = v[1]*eye[0] + v[5]*eye[1] + v[9]*eye[2]  + v[13];
    const tz = v[2]*eye[0] + v[6]*eye[1] + v[10]*eye[2] + v[14];
    expect(tx).toBeCloseTo(0, 3);
    expect(ty).toBeCloseTo(0, 3);
    expect(tz).toBeCloseTo(0, 3);
  });
});

// ---- projectDirToScreen ----

describe('projectDirToScreen', () => {
  const proj = perspective(Math.PI / 3, 1, 0.5, 100);
  const view = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);

  it('projects a direction toward the camera center near screen center', () => {
    const [sx, sy] = projectDirToScreen([0, 0, -1], view, proj);
    // should land near (0.5, 0.5) since looking straight at -Z from +Z
    expect(sx).toBeCloseTo(0.5, 1);
    expect(sy).toBeCloseTo(0.5, 1);
  });

  it('projects an upward direction to upper half of screen', () => {
    const [, sy] = projectDirToScreen([0, 1, 0], view, proj);
    expect(sy).toBeGreaterThan(0.5);
  });

  it('returns finite values for oblique directions', () => {
    const [sx, sy] = projectDirToScreen([1, 0.5, -0.5], view, proj);
    expect(Number.isFinite(sx)).toBe(true);
    expect(Number.isFinite(sy)).toBe(true);
  });
});
