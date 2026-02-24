import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const baseUrl = process.env.MARKET_TEXTURE_API_BASE_URL;
const token = process.env.MARKET_TEXTURE_API_TOKEN;
const apiKey = process.env.MARKET_TEXTURE_API_KEY;

if (!baseUrl) {
  throw new Error('Missing MARKET_TEXTURE_API_BASE_URL');
}
if (!token) {
  throw new Error('Missing MARKET_TEXTURE_API_TOKEN');
}

const endpoint = `${baseUrl.replace(/\/$/, '')}/market/texture`;
const headers = {
  Authorization: `Bearer ${token}`,
};

if (apiKey) {
  headers['x-api-key'] = apiKey;
}

const response = await fetch(endpoint, {
  method: 'GET',
  headers,
  cache: 'no-store',
});

if (!response.ok) {
  throw new Error(`Market texture fetch failed: ${response.status} ${response.statusText}`);
}

const payload = Buffer.from(await response.arrayBuffer());
const outputPath = 'public/market-texture.bin';
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, payload);

console.log('[market-texture] downloaded', {
  endpoint,
  bytes: payload.byteLength,
  width: response.headers.get('X-MarketTex-Width'),
  height: response.headers.get('X-MarketTex-Height'),
  format: response.headers.get('X-MarketTex-Format'),
});
