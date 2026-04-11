import {
  getAppSettingValue,
  setAppSetting,
} from '@/lib/repositories/appSettingsRepository';
import {
  getSettingByKey,
  setSetting,
} from '@/lib/repositories/settingsRepository';
import { noCache } from '@/lib/api-response';
import {
  EVA_APP_ID,
  EVA_MARKER_START,
  EVA_MARKER_END,
  EVA_MARKER_REGEX,
} from '@/lib/apps/eva-css/types';
import {
  generateIntensityCSS,
  cleanOverrides,
  INTENSITY_MARKER_REGEX,
} from '@/lib/apps/eva-css/intensity';
import type { IntensityOverrides } from '@/lib/apps/eva-css/intensity';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// GET — return current intensity overrides { className → suffix }
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    let overrides =
      (await getAppSettingValue<IntensityOverrides>(
        EVA_APP_ID,
        'intensity_overrides'
      )) ?? {};

    // Clean old layerId::className format on read
    const cleaned = cleanOverrides(overrides);
    if (Object.keys(cleaned).length !== Object.keys(overrides).length) {
      await setAppSetting(EVA_APP_ID, 'intensity_overrides', cleaned);
      overrides = cleaned;
    }

    return noCache({ data: overrides });
  } catch (error) {
    console.error('[Eva CSS] Failed to read intensity overrides:', error);
    return noCache({ error: 'Failed to read overrides' }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST — save override + patch bridge CSS intensity section (fast)
// Body: { className, intensity }
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { className, intensity } = await request.json();

    if (!className) {
      return noCache({ error: 'className is required' }, 400);
    }

    // 1. Load, clean, and update overrides
    const raw =
      (await getAppSettingValue<IntensityOverrides>(
        EVA_APP_ID,
        'intensity_overrides'
      )) ?? {};
    const overrides = cleanOverrides(raw);

    if (!intensity || intensity === '') {
      delete overrides[className];
    } else {
      overrides[className] = intensity;
    }

    await setAppSetting(EVA_APP_ID, 'intensity_overrides', overrides);

    // 2. Patch the intensity section in existing bridge CSS (no full regen)
    let bridgeCss =
      ((await getSettingByKey('eva_bridge_css')) as string) || '';

    if (bridgeCss) {
      // Strip any old per-layer [data-layer-id] rules (from before refactor)
      bridgeCss = bridgeCss
        .split('\n')
        .filter((line) => !line.includes('[data-layer-id='))
        .join('\n');

      // Strip old unmarked intensity comment
      bridgeCss = bridgeCss.replace(
        /\n?\/\* Eva CSS — Intensity overrides \*\/\n?/g,
        ''
      );

      const intensityBlock = generateIntensityCSS(overrides);

      let updated: string;
      // Reset regex lastIndex before test (global flag)
      INTENSITY_MARKER_REGEX.lastIndex = 0;
      if (INTENSITY_MARKER_REGEX.test(bridgeCss)) {
        INTENSITY_MARKER_REGEX.lastIndex = 0;
        updated = bridgeCss.replace(INTENSITY_MARKER_REGEX, intensityBlock);
      } else {
        updated = bridgeCss + intensityBlock;
      }

      await setSetting('eva_bridge_css', updated);

      // Also update custom_code_head
      const head =
        ((await getSettingByKey('custom_code_head')) as string) || '';
      const cleanedHead = head.replace(EVA_MARKER_REGEX, '').trim();
      const block = `${EVA_MARKER_START}\n<style id="eva-bridge">\n${updated}\n</style>\n${EVA_MARKER_END}\n`;
      const newHead = cleanedHead ? `${block}\n${cleanedHead}` : block;
      await setSetting('custom_code_head', newHead);
    }

    return noCache({ data: { overrides } });
  } catch (error) {
    console.error('[Eva CSS] Intensity update failed:', error);
    return noCache(
      {
        error:
          error instanceof Error ? error.message : 'Intensity update failed',
      },
      500
    );
  }
}
