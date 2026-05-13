/**
 * Eva CSS Bridge Route
 *
 * Serves the generated Eva bridge CSS as a cacheable external stylesheet,
 * so it isn't re-inlined into every published page's <head>.
 *
 * Cache-busting is handled by the `?v=<hash>` query string that the generator
 * injects into the <link> tag, so this response can be marked immutable.
 */

import { NextResponse } from 'next/server';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const css = ((await getSettingByKey('eva_bridge_css')) as string) || '';

    return new NextResponse(css, {
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[eva-bridge.css] Failed to load bridge CSS:', error);
    return new NextResponse('/* Eva bridge CSS unavailable */', {
      status: 200,
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
}
