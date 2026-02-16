import { GET } from '../route';

describe('GET /api/market-data', () => {
  it('returns a 200 response', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('sets Content-Type to application/octet-stream', async () => {
    const res = await GET();
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('sets Cache-Control to no-store', async () => {
    const res = await GET();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns exactly 256 bytes (64 float32s)', async () => {
    const res = await GET();
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBe(256);
  });

  it('body is a valid Float32Array', async () => {
    const res = await GET();
    const buf = await res.arrayBuffer();
    const data = new Float32Array(buf);
    expect(data.length).toBe(64);
    // all values should be finite numbers
    for (let i = 0; i < 64; i++) {
      expect(Number.isFinite(data[i])).toBe(true);
    }
  });

  // ---- meta row checks ----

  it('has session open and close times in meta row', async () => {
    const res = await GET();
    const buf = await res.arrayBuffer();
    const data = new Float32Array(buf);
    const m = 7 * 8;
    const open = data[m + 4];
    const close = data[m + 5];
    // both should be positive unix timestamps
    expect(open).toBeGreaterThan(0);
    expect(close).toBeGreaterThan(0);
    // close should be after open
    expect(close).toBeGreaterThan(open);
  });

  it('session times correspond to 13:30–20:00 UTC window', async () => {
    const res = await GET();
    const buf = await res.arrayBuffer();
    const data = new Float32Array(buf);
    const m = 7 * 8;
    const open = data[m + 4];
    const close = data[m + 5];
    // duration should be 6.5 hours = 23400 seconds
    // float32 precision on large UTC timestamps (~1.77e9) introduces ±128 rounding
    expect(Math.abs(close - open - 23400)).toBeLessThan(256);
  });

  it('instrument rows have values in expected ranges', async () => {
    const res = await GET();
    const buf = await res.arrayBuffer();
    const data = new Float32Array(buf);
    for (let i = 0; i < 7; i++) {
      const base = i * 8;
      // rank values (cols 0-4) should be in [-1, 1]
      for (let c = 0; c < 5; c++) {
        expect(data[base + c]).toBeGreaterThanOrEqual(-1);
        expect(data[base + c]).toBeLessThanOrEqual(1);
      }
      // abs_ret (col 5) and seed (col 6) should be in [0, 1]
      expect(data[base + 5]).toBeGreaterThanOrEqual(0);
      expect(data[base + 5]).toBeLessThanOrEqual(1);
      expect(data[base + 6]).toBeGreaterThanOrEqual(0);
      expect(data[base + 6]).toBeLessThanOrEqual(1);
    }
  });

  it('meta row has plausible VIX/SPY/NDX norms', async () => {
    const res = await GET();
    const buf = await res.arrayBuffer();
    const data = new Float32Array(buf);
    const m = 7 * 8;
    // hardcoded mock values
    expect(data[m + 0]).toBeCloseTo(0.35);  // vix
    expect(data[m + 1]).toBeCloseTo(0.15);  // vix chg
    expect(data[m + 2]).toBeCloseTo(0.20);  // spy
    expect(data[m + 3]).toBeCloseTo(0.45);  // ndx
  });
});
