/**
 * Settings Service
 *
 * Business logic for managing application settings
 */

import { getSettingsByKeys, setSetting } from '@/lib/repositories/settingsRepository';
import type { Setting } from '@/types';

/**
 * Sync CSS between draft and published based on direction.
 * Publish: draft_css → published_css
 * Revert: published_css → draft_css
 *
 * @returns True if CSS was updated, false if unchanged or missing
 */
export async function syncCSS(direction: 'publish' | 'revert' = 'publish'): Promise<boolean> {
  const { draft_css: draftCSS, published_css: publishedCSS } =
    await getSettingsByKeys(['draft_css', 'published_css']);

  const sourceCSS = direction === 'publish' ? draftCSS : publishedCSS;
  const targetCSS = direction === 'publish' ? publishedCSS : draftCSS;
  const targetKey = direction === 'publish' ? 'published_css' : 'draft_css';

  if (!sourceCSS) {
    if (direction === 'publish') {
      throw new Error('draft_css is empty — open the builder to generate CSS before publishing');
    }
    return false;
  }

  if (sourceCSS === targetCSS) {
    return false;
  }

  await setSetting(targetKey, sourceCSS);
  return true;
}

/** @deprecated Use syncCSS('publish') instead */
export const publishCSS = () => syncCSS('publish');

/**
 * Save the published timestamp
 * @param timestamp - ISO timestamp string
 * @returns The created/updated setting
 */
export async function savePublishedAt(timestamp: string): Promise<Setting> {
  return await setSetting('published_at', timestamp);
}
