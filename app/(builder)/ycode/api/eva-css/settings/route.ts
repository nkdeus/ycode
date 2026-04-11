import { NextRequest } from 'next/server';
import {
  getAppSettingValue,
  setAppSetting,
} from '@/lib/repositories/appSettingsRepository';
import { noCache } from '@/lib/api-response';
import { EVA_APP_ID, DEFAULT_EVA_CONFIG } from '@/lib/apps/eva-css/types';
import type { EvaCssConfig } from '@/lib/apps/eva-css/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/eva-css/settings
 * Returns { enabled, config }
 */
export async function GET() {
  try {
    const enabled = await getAppSettingValue<boolean>(EVA_APP_ID, 'enabled');
    const config = await getAppSettingValue<EvaCssConfig>(EVA_APP_ID, 'config');

    return noCache({
      data: {
        enabled: enabled ?? false,
        config: config ?? DEFAULT_EVA_CONFIG,
      },
    });
  } catch (error) {
    console.error('[Eva CSS] Error fetching settings:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch Eva CSS settings' },
      500
    );
  }
}

/**
 * PUT /ycode/api/eva-css/settings
 * Body: { enabled?: boolean, config?: EvaCssConfig }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.enabled !== undefined) {
      await setAppSetting(EVA_APP_ID, 'enabled', body.enabled);
    }
    if (body.config !== undefined) {
      await setAppSetting(EVA_APP_ID, 'config', body.config);
    }

    const enabled = await getAppSettingValue<boolean>(EVA_APP_ID, 'enabled');
    const config = await getAppSettingValue<EvaCssConfig>(EVA_APP_ID, 'config');

    return noCache({
      data: {
        enabled: enabled ?? false,
        config: config ?? DEFAULT_EVA_CONFIG,
      },
    });
  } catch (error) {
    console.error('[Eva CSS] Error updating settings:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to update Eva CSS settings' },
      500
    );
  }
}
