/**
 * Per-page schema.org type
 *
 * Every page ships a `WebPage` node by default. Nothing in the data model says
 * what a page actually *is* — a guide, a service, a contact form — and
 * inferring it from the content produces confident mistakes: an `Article` on a
 * product page is worse for search and for language models than no type at all.
 * So the owner picks, per page, and the generator fills the type in from data
 * the site already holds.
 *
 * Only types that can be populated without asking for new information are
 * offered. `Product` and `Event` are absent on purpose: they need prices,
 * availability, dates and venues that live nowhere in Ycode, and a node missing
 * its required properties is rejected rather than ignored.
 */

/** Types that are `WebPage` subtypes — they retype the page node in place. */
const WEB_PAGE_SUBTYPES = ['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage'] as const;

/** Types that describe the page's subject — emitted as their own linked node. */
const ENTITY_TYPES = ['Article', 'Service'] as const;

export type WebPageSubtype = typeof WEB_PAGE_SUBTYPES[number];
export type EntityType = typeof ENTITY_TYPES[number];
export type PageSchemaType = WebPageSubtype | EntityType;

export const DEFAULT_PAGE_SCHEMA_TYPE: PageSchemaType = 'WebPage';

/** Options for the page settings selector, in the order they should be shown. */
export const PAGE_SCHEMA_TYPE_OPTIONS: { value: PageSchemaType; label: string; hint: string }[] = [
  { value: 'WebPage', label: 'Page', hint: 'The default. Use it whenever nothing below fits.' },
  { value: 'Article', label: 'Article', hint: 'Guides, blog posts, news. Adds the publication and update dates, and credits the author.' },
  { value: 'Service', label: 'Service', hint: 'What you sell or provide. Adds the provider and the areas you serve.' },
  { value: 'AboutPage', label: 'About', hint: 'Who is behind the site — team, story, mission.' },
  { value: 'ContactPage', label: 'Contact', hint: 'How to reach you: a contact form, a quote request.' },
  { value: 'CollectionPage', label: 'Listing', hint: 'An index of other pages — a blog home, a resource library.' },
];

export function isWebPageSubtype(type: PageSchemaType): type is WebPageSubtype {
  return (WEB_PAGE_SUBTYPES as readonly string[]).includes(type);
}

/**
 * Read a stored value into a known type, falling back to the default rather
 * than emitting whatever string happens to be in the database — that string
 * would ship as an `@type` on every page and a made-up type is invalid markup.
 */
export function parsePageSchemaType(raw: unknown): PageSchemaType {
  if (typeof raw !== 'string') return DEFAULT_PAGE_SCHEMA_TYPE;
  const all = [...WEB_PAGE_SUBTYPES, ...ENTITY_TYPES] as readonly string[];
  return all.includes(raw) ? (raw as PageSchemaType) : DEFAULT_PAGE_SCHEMA_TYPE;
}

export interface EntityNodeInput {
  type: EntityType;
  pageUrl: string;
  webPageId: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  lang?: string | null;
  published?: string | null;
  modified?: string | null;
  /** `@id` of the Organization node, when the site has one configured. */
  organizationId?: string | null;
  /** Cities the business serves, from the business identity. */
  areaServed?: string[];
}

/**
 * Build the node describing what the page is about, linked to its `WebPage`.
 *
 * Kept separate from the page node rather than merged into it: `breadcrumb` and
 * `isPartOf` are `WebPage` properties, `headline` and `author` are not, and a
 * single node carrying both would be invalid. Two linked nodes say the same
 * thing correctly.
 */
export function buildEntityNode(input: EntityNodeInput): Record<string, unknown> {
  const node: Record<string, unknown> = {
    '@type': input.type,
    '@id': `${input.pageUrl}#${input.type.toLowerCase()}`,
    mainEntityOfPage: { '@id': input.webPageId },
  };

  if (input.lang) node.inLanguage = input.lang;
  if (input.description) node.description = input.description;
  if (input.imageUrl) node.image = input.imageUrl;

  if (input.type === 'Article') {
    node.headline = input.title;
    if (input.published) node.datePublished = input.published;
    if (input.modified) node.dateModified = input.modified;
    if (input.organizationId) {
      node.author = { '@id': input.organizationId };
      node.publisher = { '@id': input.organizationId };
    }
    return node;
  }

  // Service
  node.name = input.title;
  if (input.organizationId) node.provider = { '@id': input.organizationId };
  if (input.areaServed?.length) {
    node.areaServed = input.areaServed.map((area) => ({ '@type': 'City', name: area }));
  }
  return node;
}
