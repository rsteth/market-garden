/**
 * GET /api/market-data
 * Returns a 256-byte binary blob (64 float32s) encoding a 2×8 RGBA texture.
 *
 * Layout — see README / data contract:
 *   rows 0..6: 7 instruments
 *     texel(0,y) = [rank_ret_1d, rank_ret_1w, rank_ret_1m, rank_iv_atm]  all [-1,1]
 *     texel(1,y) = [iv_atm_change_1w, abs_ret_1w, seed_0to1, reserved]
 *   row 7: meta
 *     texel(0,7) = [vix_level_norm, vix_change_1w_norm, spy_ret_1d_norm, ndx_ret_1w_norm]
 *     texel(1,7) = [session_open_utc, session_close_utc, 0, 0]
 *
 * Currently serves plausible mock data. Replace with real feed later.
 */

import { NextResponse } from 'next/server';

// deterministic-ish seed per server start so the garden is stable across reloads
let callCount = 0;

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export async function GET() {
  callCount++;
  const data = new Float32Array(64);

  // 7 instruments
  for (let i = 0; i < 7; i++) {
    const base = i * 8;
    const s = i * 7 + callCount * 0.01; // slow drift across calls
    data[base + 0] = seededRandom(s + 0.1) * 2 - 1;   // rank_ret_1d
    data[base + 1] = seededRandom(s + 0.2) * 2 - 1;   // rank_ret_1w
    data[base + 2] = seededRandom(s + 0.3) * 2 - 1;   // rank_ret_1m
    data[base + 3] = seededRandom(s + 0.4) * 2 - 1;   // rank_iv_atm
    data[base + 4] = seededRandom(s + 0.5) * 2 - 1;   // iv_atm_change_1w
    data[base + 5] = seededRandom(s + 0.6);            // abs_ret_1w  (>=0)
    data[base + 6] = seededRandom(s + 0.7);            // seed
    data[base + 7] = 0;                                 // reserved
  }

  // meta row (y=7)
  const m = 7 * 8;
  data[m + 0] =  0.35;  // vix_level_norm  (moderate wind)
  data[m + 1] =  0.15;  // vix_change_1w   (slight gust)
  data[m + 2] =  0.20;  // spy_ret_1d      (decent day → low fog)
  data[m + 3] =  0.45;  // ndx_ret_1w      (positive → some aurora)

  // session open/close: 9:30 ET → 13:30 UTC, 16:00 ET → 20:00 UTC
  const nowUtc = Date.now() / 1000;
  const midnightUtc = Math.floor(nowUtc / 86400) * 86400;
  data[m + 4] = midnightUtc + 13.5 * 3600;  // open
  data[m + 5] = midnightUtc + 20   * 3600;  // close
  data[m + 6] = 0;
  data[m + 7] = 0;

  const buffer = Buffer.from(data.buffer);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store',
    },
  });
}
