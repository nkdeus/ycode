import { noCache } from '@/lib/api-response';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /ycode/api/eva-css/preview
 * Body: { size, type?, config }
 * Returns clamp values for each intensity — used for live preview in settings UI.
 */
export async function POST(request: NextRequest) {
  try {
    const { size, type = 'spacing', config } = await request.json();

    if (!size || !config) {
      return noCache({ error: 'size and config are required' }, 400);
    }

    const { generateClamp } = await import('eva-css-for-tailwind');

    const intensities: ('' | '__' | '_' | '-')[] =
      type === 'font'
        ? ['__', '_', '']
        : ['__', '_', '', '-'];

    const clamps: Record<string, string> = {};
    for (const i of intensities) {
      let clamp = generateClamp(size, type, i, config) as string;

      // Apply extremeFloor post-processing for __ intensity
      if (i === '__' && config.extremeFloor != null && config.extremeFloor > 0) {
        clamp = clamp.replace(
          /clamp\([\d.]+rem/,
          `clamp(${config.extremeFloor}rem`
        );
      }

      const label =
        i === '__' ? 'extreme' : i === '_' ? 'strong' : i === '' ? 'normal' : 'light';
      clamps[label] = clamp;
    }

    return noCache({ data: { size, type, clamps } });
  } catch (error) {
    return noCache(
      { error: error instanceof Error ? error.message : 'Preview failed' },
      500
    );
  }
}
