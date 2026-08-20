/**
 * Dynamic llms.txt Route
 *
 * Serves the custom llms.txt from settings when one is set, and otherwise
 * generates it from the published pages and collections.
 * See: https://llmstxt.org/
 */

import { NextResponse } from 'next/server';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { generateLlmsTxt } from '@/lib/geo/llms-txt';

const HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=86400, s-maxage=86400',
};

export async function GET() {
  try {
    const customLlms = await getSettingByKey('llms_txt');

    if (customLlms && typeof customLlms === 'string' && customLlms.trim()) {
      return new NextResponse(customLlms.trim(), { headers: HEADERS });
    }

    const generated = await generateLlmsTxt();
    if (generated) {
      return new NextResponse(generated, { headers: HEADERS });
    }

    return new NextResponse(null, { status: 404 });
  } catch (error) {
    console.error('[llms.txt] Error:', error);
    return new NextResponse(null, { status: 404 });
  }
}
