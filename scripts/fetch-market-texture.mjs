import { mkdir, writeFile } from 'node:fs/promises';

const upstreamUrl = process.env.MARKET_TEXTURE_UPSTREAM_URL;
const token = process.env.MARKET_TEXTURE_API_TOKEN;
const apiKey = process.env.MARKET_TEXTURE_API_KEY;

if (!upstreamUrl) {
  throw new Error('Missing MARKET_TEXTURE_UPSTREAM_URL');
}
if (!token) {
  throw new Error('Missing MARKET_TEXTURE_API_TOKEN');
}

const headers = new Headers();
headers.set('Authorization', `Bearer ${token}`);
if (apiKey) {
  headers.set('x-api-key', apiKey);
}

const res = await fetch(upstreamUrl, {
  method: 'GET',
  headers,
  cache: 'no-store',
});

if (!res.ok) {
  throw new Error(`Market texture request failed: ${res.status} ${res.statusText}`);
}

const width = Number(res.headers.get('X-MarketTex-Width') ?? '4');
const height = Number(res.headers.get('X-MarketTex-Height') ?? '8');
const format = res.headers.get('X-MarketTex-Format') ?? 'RGBA32F';
const tickers = res.headers.get('X-MarketTex-Tickers') ?? '';

if (width !== 4 || height !== 8 || format !== 'RGBA32F') {
  throw new Error(`Unexpected texture layout ${width}x${height} ${format}`);
}

const payload = Buffer.from(await res.arrayBuffer());
if (payload.byteLength !== 4 * 8 * 4 * 4) {
  throw new Error(`Unexpected byte length ${payload.byteLength}, expected 512`);
}

await mkdir('public', { recursive: true });
await writeFile('public/market-texture.bin', payload);
await writeFile(
  'public/market-texture-meta.json',
  JSON.stringify(
    {
      width,
      height,
      format,
      tickers,
      fetchedAtUtc: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log('[market-texture] Wrote public/market-texture.bin and metadata');
