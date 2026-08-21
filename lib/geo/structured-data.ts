/**
 * Structured data (JSON-LD) for published pages
 *
 * Ycode shipped no structured data at all: the only way to get any was to hand
 * write a `<script type="application/ld+json">` into a page's custom head code,
 * one page at a time. Sites therefore went live declaring no entities, and a
 * language model reading them had to infer what the page even was.
 *
 * What is emitted here is strictly derived from data the site already holds —
 * SEO title and description, folder hierarchy, locale, timestamps, social
 * image. Nothing is guessed. Schema types that would require asserting facts
 * Ycode doesn't store (Organization, LocalBusiness, Product, FAQPage) are
 * deliberately left out: structured data that contradicts the page is worse
 * than none, and search engines penalise it.
 *
 * See docs/geo-roadmap.md for the entity types that need a settings panel
 * before they can be generated.
 */

import { unstable_cache } from 'next/cache';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { buildOrganizationNode, parseBusinessIdentity } from '@/lib/geo/business-identity';
import { buildEntityNode, isWebPageSubtype, parsePageSchemaType } from '@/lib/geo/schema-types';
import { getTranslatedText } from '@/lib/locale-runtime';
import { resolveInlineVariables } from '@/lib/inline-variables';
import { resolveImageUrl } from '@/lib/resolve-cms-variables';
import { buildSlugPath, buildDynamicPageUrl } from '@/lib/page-utils';
import { buildAbsolutePageUrl, buildAbsoluteAssetUrl, getSiteBaseUrl } from '@/lib/url-utils';
import type { CollectionItemWithValues, Page, PageFolder, Translation } from '@/types';

export interface PageStructuredDataInput {
  page: Page;
  /** All published pages — used to find the home page for the WebSite node. */
  pages: Page[];
  folders: PageFolder[];
  collectionItem?: CollectionItemWithValues | null;
  translations?: Record<string, Translation> | null;
  /** Resolved page locale code, for `inLanguage`. */
  lang?: string | null;
  usePublishedData: boolean;
}

/**
 * Site base URL, resolved once per deployment rather than per page render.
 * Invalidated with the rest of the site on publish.
 */
const getCachedSiteBaseUrl = unstable_cache(
  async () => {
    try {
      const globalCanonicalUrl = await getSettingByKey('global_canonical_url');
      return getSiteBaseUrl({
        globalCanonicalUrl: typeof globalCanonicalUrl === 'string' ? globalCanonicalUrl : null,
      });
    } catch {
      return getSiteBaseUrl();
    }
  },
  ['geo-site-base-url'],
  { tags: ['all-pages'], revalidate: false },
);

/** Business facts the owner entered, shared by every page render. */
const getCachedBusinessIdentity = unstable_cache(
  async () => {
    try {
      return parseBusinessIdentity(await getSettingByKey('business_identity'));
    } catch {
      return null;
    }
  },
  ['geo-business-identity'],
  { tags: ['all-pages'], revalidate: false },
);

function clean(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * The SEO title/description as the page actually serves it: translated for the
 * current locale, then with CMS field variables resolved against the item.
 */
function resolveSeoText(
  raw: string | undefined,
  key: 'seo:title' | 'seo:description',
  input: PageStructuredDataInput,
): string {
  const translated = getTranslatedText(raw, key, input.translations ?? undefined, input.page.id);
  if (!translated) return '';
  return clean(
    input.collectionItem ? resolveInlineVariables(translated, input.collectionItem) : translated,
  );
}

/** Path of the page being rendered, with the CMS slug filled in for dynamic pages. */
function resolvePagePath(page: Page, folders: PageFolder[], slug: string | null): string {
  return page.is_dynamic
    ? buildDynamicPageUrl(page, folders, slug)
    : buildSlugPath(page, folders, 'page');
}

/** Slug of the collection item on a dynamic page, from the page's slug field. */
function collectionItemSlug(input: PageStructuredDataInput): string | null {
  const slugFieldId = input.page.settings?.cms?.slug_field_id;
  if (!slugFieldId || !input.collectionItem) return null;
  const value = input.collectionItem.values?.[slugFieldId];
  return value ? String(value) : null;
}

/**
 * Home → folders → current page. Returns null below two entries, where a
 * breadcrumb carries no information.
 *
 * Labels come from the editor names — short, and already in the site's own
 * language — rather than SEO titles, which are written for search results and
 * read as sentences in a trail. Dynamic pages are the exception: their editor
 * name is the template's ("article"), the same on every item, so the resolved
 * title is the only label that identifies the page.
 */
function buildBreadcrumb(
  input: PageStructuredDataInput,
  home: Page | undefined,
  baseUrl: string,
  pageUrl: string,
  title: string,
): Record<string, unknown> | null {
  const trail: { name: string; url: string }[] = [
    { name: clean(home?.name) || 'Home', url: baseUrl },
  ];

  // Walk up the folder chain, then reverse into root-first order.
  const chain: PageFolder[] = [];
  let folderId = input.page.page_folder_id;
  while (folderId) {
    const folder = input.folders.find((f) => f.id === folderId);
    if (!folder) break;
    chain.unshift(folder);
    folderId = folder.page_folder_id;
  }

  for (const folder of chain) {
    trail.push({
      name: clean(folder.name) || folder.slug,
      url: buildAbsolutePageUrl(baseUrl, buildSlugPath(folder, input.folders, 'folder')),
    });
  }

  if (pageUrl !== baseUrl) {
    const leaf = input.page.is_dynamic ? title : clean(input.page.name) || title;
    trail.push({ name: leaf, url: pageUrl });
  }

  if (trail.length < 2) return null;

  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: step.url,
    })),
  };
}

/**
 * Build the JSON-LD `@graph` for a page, serialized and ready to inject.
 *
 * Returns null when there is nothing trustworthy to say — no base URL to build
 * absolute `@id`s from, or a page excluded from indexing.
 */
export async function buildPageStructuredData(
  input: PageStructuredDataInput,
): Promise<string | null> {
  const { page } = input;

  if (page.error_page !== null || page.settings?.seo?.noindex) return null;

  const baseUrl = await getCachedSiteBaseUrl();
  if (!baseUrl) return null;

  const pagePath = resolvePagePath(page, input.folders, collectionItemSlug(input));
  const pageUrl = buildAbsolutePageUrl(baseUrl, pagePath);

  const title = resolveSeoText(page.settings?.seo?.title, 'seo:title', input)
    || clean(page.name)
    || 'Page';
  const description = resolveSeoText(page.settings?.seo?.description, 'seo:description', input);

  const home = input.pages.find((p) => p.is_index && p.page_folder_id === null);
  const siteName = clean(home?.settings?.seo?.title) || clean(home?.name) || title;
  const websiteId = `${baseUrl}/#website`;

  const imageUrl = buildAbsoluteAssetUrl(
    baseUrl,
    await resolveImageUrl(
      page.settings?.seo?.image ?? null,
      input.collectionItem,
      input.usePublishedData,
    ).catch(() => null),
  );

  // A CMS-driven page is dated by its item; a static page by the page row,
  // the same timestamp the sitemap reports as lastmod.
  const published = input.collectionItem?.created_at || page.created_at;
  const modified = input.collectionItem?.updated_at || page.updated_at;

  const breadcrumb = buildBreadcrumb(input, home, baseUrl, pageUrl, title);

  // The owner's answer to "what is this page?". A WebPage subtype retypes the
  // page node itself; anything else describes the page's subject and becomes a
  // second node linked to it.
  const schemaType = parsePageSchemaType(page.settings?.seo?.schema_type);
  const webPageId = `${pageUrl}#webpage`;

  const webPage: Record<string, unknown> = {
    '@type': isWebPageSubtype(schemaType) ? schemaType : 'WebPage',
    '@id': webPageId,
    url: pageUrl,
    name: title,
    isPartOf: { '@id': websiteId },
  };

  webPage._debug = JSON.stringify({
    raw: page.settings?.seo?.schema_type ?? null,
    resolved: schemaType,
    dyn: page.is_dynamic,
    pid: page.id.slice(0, 8),
    seoKeys: Object.keys(page.settings?.seo || {}).join('|'),
  });

  if (description) webPage.description = description;
  if (input.lang) webPage.inLanguage = input.lang;
  if (published) webPage.datePublished = published;
  if (modified) webPage.dateModified = modified;
  if (imageUrl) webPage.primaryImageOfPage = { '@type': 'ImageObject', url: imageUrl };
  if (breadcrumb) webPage.breadcrumb = { '@id': breadcrumb['@id'] };

  const website: Record<string, unknown> = {
    '@type': 'WebSite',
    '@id': websiteId,
    url: baseUrl,
    name: siteName,
  };

  if (input.lang) website.inLanguage = input.lang;

  const homeDescription = clean(home?.settings?.seo?.description);
  if (homeDescription) website.description = homeDescription;

  const identity = await getCachedBusinessIdentity();
  const organization = buildOrganizationNode(identity, baseUrl, siteName);

  if (organization) {
    website.publisher = { '@id': organization['@id'] };
  }

  const entity = isWebPageSubtype(schemaType)
    ? null
    : buildEntityNode({
      type: schemaType,
      pageUrl,
      webPageId,
      title,
      description,
      imageUrl,
      lang: input.lang,
      published,
      modified,
      organizationId: organization ? String(organization['@id']) : null,
      areaServed: identity?.areaServed,
    });

  if (entity) {
    webPage.mainEntity = { '@id': entity['@id'] };
  }

  const graph: Record<string, unknown>[] = [website, webPage];
  if (entity) graph.push(entity);
  if (organization) graph.push(organization);
  if (breadcrumb) graph.push(breadcrumb);

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}
