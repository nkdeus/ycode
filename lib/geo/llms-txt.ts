/**
 * llms.txt generation
 *
 * Builds an llms.txt document from the published site — the site title and
 * summary from the home page's SEO settings, then one section per page folder
 * and one per CMS collection. See https://llmstxt.org/ for the format.
 *
 * Ycode only ever served llms.txt when a site owner pasted one into Settings →
 * General, so in practice the route answered 404 on nearly every site. The
 * content needed to write that file by hand — page titles, descriptions, URLs —
 * is already in the database, so it is generated here instead. A pasted
 * llms.txt still wins: this is the fallback, not a replacement.
 *
 * Kept out of the route handler so the route stays a thin shim and this stays
 * unit-testable without a request.
 */

import { getAllPages } from '@/lib/repositories/pageRepository';
import { getAllPublishedPageFolders } from '@/lib/repositories/pageFolderRepository';
import { getSettingsByKeys } from '@/lib/repositories/settingsRepository';
import { getCollectionById } from '@/lib/repositories/collectionRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import { getItemsByCollectionId } from '@/lib/repositories/collectionItemRepository';
import { getValuesByItemIds } from '@/lib/repositories/collectionItemValueRepository';
import { buildSlugPath, buildDynamicPageUrl } from '@/lib/page-utils';
import { resolveInlineVariables } from '@/lib/inline-variables';
import { buildAbsolutePageUrl, getSiteBaseUrl } from '@/lib/url-utils';
import type { CollectionItemWithValues, Page, PageFolder } from '@/types';

/** A single `- [title](url): description` line. */
export interface LlmsTxtEntry {
  title: string;
  url: string;
  description?: string;
}

/** A `## Heading` block and the entries under it. */
export interface LlmsTxtSection {
  heading: string;
  entries: LlmsTxtEntry[];
}

export interface LlmsTxtDoc {
  title: string;
  summary?: string;
  sections: LlmsTxtSection[];
}

/** Heading used for pages that sit at the root, outside any folder. */
const ROOT_SECTION_HEADING = 'Pages';

/**
 * Collapse whitespace and strip markdown link syntax, which would otherwise
 * nest brackets inside a list entry and break the line.
 */
function clean(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/\s+/g, ' ')
    .replace(/[[\]]/g, '')
    .trim();
}

/**
 * Render a doc to llms.txt. Pure — no I/O, so the shape above is the only
 * contract callers need.
 */
export function renderLlmsTxt(doc: LlmsTxtDoc): string {
  const lines: string[] = [`# ${doc.title}`];

  if (doc.summary) {
    lines.push('', `> ${doc.summary}`);
  }

  for (const section of doc.sections) {
    if (section.entries.length === 0) continue;

    lines.push('', `## ${section.heading}`, '');

    for (const entry of section.entries) {
      const suffix = entry.description ? `: ${entry.description}` : '';
      lines.push(`- [${entry.title}](${entry.url})${suffix}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

/** The root index page — the site's home. */
function findHomePage(pages: Page[]): Page | null {
  return (
    pages.find((p) => p.is_index && p.page_folder_id === null)
    || pages.find((p) => p.slug === '' || p.slug === '/')
    || null
  );
}

/** SEO title if the owner set one, else the page name from the editor. */
function pageTitle(page: Page): string {
  return clean(page.settings?.seo?.title) || clean(page.name) || page.slug;
}

/**
 * Pages a language model should be pointed at: live, not an error page, not
 * excluded from indexing. `noindex` is the owner saying "keep this out of
 * search" — honouring it here keeps llms.txt consistent with robots and the
 * sitemap rather than quietly reintroducing hidden pages.
 */
function isListablePage(page: Page): boolean {
  return (
    page.error_page == null
    && page.deleted_at == null
    && page.settings?.seo?.noindex !== true
  );
}

function sortByPosition<T extends { order: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
}

/**
 * One section per CMS collection behind a dynamic page, listing its published
 * items.
 *
 * A dynamic page's SEO title and description are templates holding
 * `<ycode-inline-variable>` field tokens, resolved per item at render time.
 * Resolving them here means each entry carries the same title and description
 * the page itself serves, instead of a bare item name.
 */
async function buildCollectionSection(
  page: Page,
  folders: PageFolder[],
  baseUrl: string,
): Promise<LlmsTxtSection | null> {
  const collectionId = page.settings?.cms?.collection_id;
  const slugFieldId = page.settings?.cms?.slug_field_id;
  if (!collectionId || !slugFieldId) return null;

  const [collection, fields, { items }] = await Promise.all([
    getCollectionById(collectionId, true),
    getFieldsByCollectionId(collectionId, true),
    getItemsByCollectionId(collectionId, true),
  ]);

  if (items.length === 0) return null;

  const nameFieldId = fields.find((f) => f.key === 'name')?.id || null;
  const values = await getValuesByItemIds(items.map((i) => i.id), true);

  const titleTemplate = page.settings?.seo?.title || '';
  const descriptionTemplate = page.settings?.seo?.description || '';

  const entries: LlmsTxtEntry[] = [];

  for (const item of items) {
    if (item.deleted_at) continue;

    const rawValues = values[item.id] as Record<string, string> | undefined;
    const slug = rawValues?.[slugFieldId];
    if (slug == null || String(slug) === '') continue;

    const withValues: CollectionItemWithValues = { ...item, values: rawValues || {} };
    const resolvedTitle = titleTemplate ? resolveInlineVariables(titleTemplate, withValues) : '';
    const resolvedDescription = descriptionTemplate
      ? resolveInlineVariables(descriptionTemplate, withValues)
      : '';

    const name = nameFieldId ? rawValues?.[nameFieldId] : null;
    const path = buildDynamicPageUrl(page, folders, String(slug));

    entries.push({
      title: clean(resolvedTitle) || clean(name) || String(slug),
      url: buildAbsolutePageUrl(baseUrl, path),
      description: clean(resolvedDescription) || undefined,
    });
  }

  if (entries.length === 0) return null;

  return {
    heading: clean(collection?.name) || pageTitle(page),
    entries,
  };
}

/**
 * Generate llms.txt for the published site.
 *
 * Returns `null` when there is nothing meaningful to serve — no published
 * pages, or no base URL to build absolute links from. The route turns that
 * into a 404 rather than publishing a stub.
 */
export async function generateLlmsTxt(): Promise<string | null> {
  const [settings, pages, folders] = await Promise.all([
    getSettingsByKeys(['global_canonical_url']),
    getAllPages({ is_published: true }),
    getAllPublishedPageFolders(),
  ]);

  const baseUrl = getSiteBaseUrl({ globalCanonicalUrl: settings.global_canonical_url || null });
  if (!baseUrl) return null;

  const listable = pages.filter(isListablePage);
  if (listable.length === 0) return null;

  const home = findHomePage(listable);
  const staticPages = listable.filter((p) => !p.is_dynamic);
  const dynamicPages = listable.filter((p) => p.is_dynamic && p.settings?.cms);

  // Root pages first, then one section per folder, in editor order.
  const sections: LlmsTxtSection[] = [];
  const rootEntries: LlmsTxtEntry[] = [];

  const toEntry = (page: Page): LlmsTxtEntry => ({
    title: pageTitle(page),
    url: buildAbsolutePageUrl(baseUrl, buildSlugPath(page, folders, 'page')),
    description: clean(page.settings?.seo?.description) || undefined,
  });

  // The home page leads the list regardless of its editor order — it is the
  // entry point a model should follow first.
  if (home) rootEntries.push(toEntry(home));

  for (const page of sortByPosition(staticPages)) {
    if (page.id === home?.id) continue;
    if (page.page_folder_id !== null) continue;
    rootEntries.push(toEntry(page));
  }

  if (rootEntries.length > 0) {
    sections.push({ heading: ROOT_SECTION_HEADING, entries: rootEntries });
  }

  for (const folder of sortByPosition(folders)) {
    const folderPages = sortByPosition(staticPages.filter((p) => p.page_folder_id === folder.id));
    if (folderPages.length === 0) continue;

    sections.push({
      heading: clean(folder.name) || folder.slug,
      entries: folderPages.map(toEntry),
    });
  }

  for (const page of sortByPosition(dynamicPages)) {
    try {
      const section = await buildCollectionSection(page, folders, baseUrl);
      if (section) sections.push(section);
    } catch (error) {
      // One unreadable collection shouldn't cost the whole file.
      console.error(`[llms.txt] Skipped collection for page ${page.id}:`, error);
    }
  }

  if (sections.length === 0) return null;

  return renderLlmsTxt({
    title: home ? pageTitle(home) : 'Site',
    summary: (home && clean(home.settings?.seo?.description)) || undefined,
    sections,
  });
}
