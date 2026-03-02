/** Minimal mat4 helpers — just perspective + lookAt + project. */

export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];

export function perspective(
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): Mat4 {
  const out = new Float32Array(16);
  const f = 1.0 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function lookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
  const out = new Float32Array(16);
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  let len = Math.sqrt(zx * zx + zy * zy + zz * zz);
  zx /= len; zy /= len; zz /= len;

  // side = cross(up, z)
  let sx = up[1] * zz - up[2] * zy;
  let sy = up[2] * zx - up[0] * zz;
  let sz = up[0] * zy - up[1] * zx;
  len = Math.sqrt(sx * sx + sy * sy + sz * sz);
  sx /= len; sy /= len; sz /= len;

  // u = cross(z, side)
  const ux = zy * sz - zz * sy;
  const uy = zz * sx - zx * sz;
  const uz = zx * sy - zy * sx;

  out[0] = sx;  out[1] = ux;  out[2]  = zx;
  out[4] = sy;  out[5] = uy;  out[6]  = zy;
  out[8] = sz;  out[9] = uz;  out[10] = zz;
  out[12] = -(sx * eye[0] + sy * eye[1] + sz * eye[2]);
  out[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

/** Project a world-space direction to normalised screen coords [0..1, 0..1]. */
export function projectDirToScreen(
  dir: Vec3,
  view: Mat4,
  proj: Mat4,
): [number, number] {
  const far = 100;
  const wx = dir[0] * far, wy = dir[1] * far, wz = dir[2] * far;

  // view transform
  const vx = view[0]*wx + view[4]*wy + view[8]*wz  + view[12];
  const vy = view[1]*wx + view[5]*wy + view[9]*wz  + view[13];
  const vz = view[2]*wx + view[6]*wy + view[10]*wz + view[14];
  const vw = view[3]*wx + view[7]*wy + view[11]*wz + view[15];

  // projection
  const px = proj[0]*vx + proj[4]*vy + proj[8]*vz  + proj[12]*vw;
  const py = proj[1]*vx + proj[5]*vy + proj[9]*vz  + proj[13]*vw;
  const pw = proj[3]*vx + proj[7]*vy + proj[11]*vz + proj[15]*vw;

  return [px / pw * 0.5 + 0.5, py / pw * 0.5 + 0.5];
}

/** Project a world-space point to normalised screen coords [0..1, 0..1]. */
export function projectWorldToScreen(
  point: Vec3,
  view: Mat4,
  proj: Mat4,
): [number, number] | null {
  // view transform (w = 1 for world-space points)
  const vx = view[0] * point[0] + view[4] * point[1] + view[8] * point[2] + view[12];
  const vy = view[1] * point[0] + view[5] * point[1] + view[9] * point[2] + view[13];
  const vz = view[2] * point[0] + view[6] * point[1] + view[10] * point[2] + view[14];
  const vw = view[3] * point[0] + view[7] * point[1] + view[11] * point[2] + view[15];

  // projection
  const px = proj[0] * vx + proj[4] * vy + proj[8] * vz + proj[12] * vw;
  const py = proj[1] * vx + proj[5] * vy + proj[9] * vz + proj[13] * vw;
  const pw = proj[3] * vx + proj[7] * vy + proj[11] * vz + proj[15] * vw;

  if (pw <= 0) return null;

  const sx = px / pw * 0.5 + 0.5;
  const sy = py / pw * 0.5 + 0.5;
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
  return [sx, sy];
}
