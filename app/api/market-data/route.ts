/**
 * GET /api/market-data
 * Proxies market texture bytes from the upstream finance API.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const UPSTREAM_HOST = 'finance-api-alb-250195562.us-west-2.elb.amazonaws.com';
const UPSTREAM_URL = `https://${UPSTREAM_HOST}/market/texture`;

function getBearerToken(): string | null {
  return process.env.MARKET_TEXTURE_API_TOKEN
    ?? process.env.SERVICE_BEARER_TOKEN
    ?? null;
}

export async function GET() {
  const token = getBearerToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!upstream.ok) {
      console.error('[market-data] Upstream connection failed', {
        host: UPSTREAM_HOST,
        status: upstream.status,
      });
      return NextResponse.json(
        { error: 'Failed to fetch market texture from upstream.' },
        { status: 502 },
      );
    }

    const payload = await upstream.arrayBuffer();
    console.info('[market-data] Upstream connection successful', {
      host: UPSTREAM_HOST,
      bytes: payload.byteLength,
      width: upstream.headers.get('X-MarketTex-Width'),
      height: upstream.headers.get('X-MarketTex-Height'),
      format: upstream.headers.get('X-MarketTex-Format'),
    });

    return new NextResponse(payload, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-MarketTex-Width': upstream.headers.get('X-MarketTex-Width') ?? '4',
        'X-MarketTex-Height': upstream.headers.get('X-MarketTex-Height') ?? '8',
        'X-MarketTex-Format': upstream.headers.get('X-MarketTex-Format') ?? 'RGBA32F',
        'X-MarketTex-Tickers': upstream.headers.get('X-MarketTex-Tickers') ?? '',
      },
    });
  } catch (error) {
    console.error('[market-data] Upstream connection exception', {
      host: UPSTREAM_HOST,
      error,
    });

    return NextResponse.json(
      { error: 'Market texture upstream unreachable.' },
      { status: 502 },
    );
  }
}
