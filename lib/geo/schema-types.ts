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

import type { SchemaPropertySpec } from '@/lib/geo/schema-bindings';

/** Types that are `WebPage` subtypes — they retype the page node in place. */
const WEB_PAGE_SUBTYPES = ['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage'] as const;

/** Types that describe the page's subject — emitted as their own linked node. */
const ENTITY_TYPES = ['Article', 'Service', 'Product', 'Event'] as const;

export type WebPageSubtype = typeof WEB_PAGE_SUBTYPES[number];
export type EntityType = typeof ENTITY_TYPES[number];
export type PageSchemaType = WebPageSubtype | EntityType;

export const DEFAULT_PAGE_SCHEMA_TYPE: PageSchemaType = 'WebPage';

/** Options for the page settings selector, in the order they should be shown. */
export const PAGE_SCHEMA_TYPE_OPTIONS: { value: PageSchemaType; label: string; hint: string }[] = [
  { value: 'WebPage', label: 'Page', hint: 'The default. Use it whenever nothing below fits.' },
  { value: 'Article', label: 'Article', hint: 'Guides, blog posts, news. Adds the publication and update dates, and credits the author.' },
  { value: 'Service', label: 'Service', hint: 'What you sell or provide. Adds the provider and the areas you serve.' },
  { value: 'Product', label: 'Product', hint: 'Something you sell at a price. Needs a price and a currency.' },
  { value: 'Event', label: 'Event', hint: 'Something happening at a time and a place. Needs a start date and a location.' },
  { value: 'AboutPage', label: 'About', hint: 'Who is behind the site — team, story, mission.' },
  { value: 'ContactPage', label: 'Contact', hint: 'How to reach you: a contact form, a quote request.' },
  { value: 'CollectionPage', label: 'Listing', hint: 'An index of other pages — a blog home, a resource library.' },
];

/**
 * Properties a type needs that no page holds already.
 *
 * `Article` and `Service` declare none — everything they publish comes from the
 * page's own title, description, image and timestamps. `Product` and `Event`
 * declare the values schema.org requires and Ycode has nowhere to store, each
 * bound to a CMS field or typed in directly.
 */
export const SCHEMA_TYPE_PROPERTIES: Record<EntityType, SchemaPropertySpec[]> = {
  Article: [],
  Service: [],
  Product: [
    {
      key: 'price',
      label: 'Price',
      hint: 'The number alone — 49.99, no currency symbol.',
      kind: 'number',
      required: true,
    },
    {
      key: 'priceCurrency',
      label: 'Currency',
      hint: 'Three-letter code: EUR, USD, GBP.',
      kind: 'text',
      required: true,
    },
    {
      key: 'availability',
      label: 'Availability',
      hint: 'InStock, OutOfStock or PreOrder. Left empty, it publishes as in stock.',
      kind: 'text',
      required: false,
    },
  ],
  Event: [
    {
      key: 'startDate',
      label: 'Start',
      hint: 'ISO 8601, for example 2026-09-14T19:00. A date field carries this best.',
      kind: 'date',
      required: true,
    },
    {
      key: 'endDate',
      label: 'End',
      hint: 'Same format. Optional, but search results show a date range when it is set.',
      kind: 'date',
      required: false,
    },
    {
      key: 'location',
      label: 'Location',
      hint: 'Venue name and address, as one line. Required — an event nobody can find is not published.',
      kind: 'text',
      required: true,
    },
  ],
};

export function isWebPageSubtype(type: PageSchemaType): type is WebPageSubtype {
  return (WEB_PAGE_SUBTYPES as readonly string[]).includes(type);
}

/** The properties the editor should ask for, given the selected type. */
export function propertiesForType(type: PageSchemaType): SchemaPropertySpec[] {
  return isWebPageSubtype(type) ? [] : SCHEMA_TYPE_PROPERTIES[type];
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
  /** Values for the type's own properties, already resolved to strings. */
  properties?: Record<string, string>;
}

/** schema.org spells availability as a URL, not a bare word. */
const AVAILABILITY = new Map([
  ['instock', 'https://schema.org/InStock'],
  ['outofstock', 'https://schema.org/OutOfStock'],
  ['preorder', 'https://schema.org/PreOrder'],
  ['soldout', 'https://schema.org/SoldOut'],
  ['backorder', 'https://schema.org/BackOrder'],
]);

/**
 * Build the node describing what the page is about, linked to its `WebPage`.
 *
 * Kept separate from the page node rather than merged into it: `breadcrumb` and
 * `isPartOf` are `WebPage` properties, `headline` and `author` are not, and a
 * single node carrying both would be invalid. Two linked nodes say the same
 * thing correctly.
 */
export function buildEntityNode(input: EntityNodeInput): Record<string, unknown> | null {
  const props = input.properties || {};

  // A type whose required properties aren't all resolved is not published.
  // Search engines reject an incomplete Product or Event rather than reading
  // past the gap, so a partial node costs the page its other markup too.
  const missing = SCHEMA_TYPE_PROPERTIES[input.type]
    .filter((spec) => spec.required && !props[spec.key]);
  if (missing.length > 0) return null;

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

  node.name = input.title;

  if (input.type === 'Service') {
    if (input.organizationId) node.provider = { '@id': input.organizationId };
    if (input.areaServed?.length) {
      node.areaServed = input.areaServed.map((area) => ({ '@type': 'City', name: area }));
    }
    return node;
  }

  if (input.type === 'Product') {
    if (input.organizationId) node.brand = { '@id': input.organizationId };
    node.offers = {
      '@type': 'Offer',
      price: props.price,
      priceCurrency: props.priceCurrency.toUpperCase(),
      availability: AVAILABILITY.get(props.availability?.toLowerCase().replace(/\s/g, '') || 'instock')
        || 'https://schema.org/InStock',
      url: input.pageUrl,
    };
    return node;
  }

  // Event
  node.startDate = props.startDate;
  if (props.endDate) node.endDate = props.endDate;
  node.location = { '@type': 'Place', name: props.location };
  if (input.organizationId) node.organizer = { '@id': input.organizationId };
  return node;
}
