import { GET } from '../route';

describe('GET /api/market-data', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();
    (global as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    delete process.env.MARKET_TEXTURE_API_TOKEN;
    delete process.env.SERVICE_BEARER_TOKEN;
  });

  it('returns upstream binary payload and texture headers', async () => {
    const payload = new Float32Array(4 * 8 * 4);
    fetchMock.mockResolvedValue(new Response(payload.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-MarketTex-Width': '4',
        'X-MarketTex-Height': '8',
        'X-MarketTex-Format': 'RGBA32F',
        'X-MarketTex-Tickers': 'A,B,C,D,E,F,G',
      },
    }));

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-MarketTex-Width')).toBe('4');
    expect(res.headers.get('X-MarketTex-Height')).toBe('8');
    expect(res.headers.get('X-MarketTex-Format')).toBe('RGBA32F');
    expect(res.headers.get('X-MarketTex-Tickers')).toBe('A,B,C,D,E,F,G');

    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBe(512);
  });

  it('adds bearer token when MARKET_TEXTURE_API_TOKEN is configured', async () => {
    process.env.MARKET_TEXTURE_API_TOKEN = 'market-token';
    fetchMock.mockResolvedValue(new Response(new Float32Array(128).buffer, { status: 200 }));

    await GET();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer market-token');
  });

  it('does not set Authorization when no token env is provided', async () => {
    fetchMock.mockResolvedValue(new Response(new Float32Array(128).buffer, { status: 200 }));

    await GET();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://finance-api-alb-250195562.us-west-2.elb.amazonaws.com/market/texture');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('returns 502 when upstream returns non-2xx', async () => {
    fetchMock.mockResolvedValue(new Response('bad gateway', { status: 503 }));

    const res = await GET();
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      error: 'Failed to fetch market texture from upstream.',
    });
  });

  it('returns 502 when upstream throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const res = await GET();
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({
      error: 'Market texture upstream unreachable.',
    });
  });
});
