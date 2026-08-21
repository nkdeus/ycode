/**
 * Where the values for a schema type's own properties come from
 *
 * `Article` and `Service` are built entirely from what a page already has —
 * title, description, image, timestamps. `Product` and `Event` are not: a price
 * and a start date exist nowhere in a page's settings, and schema.org rejects
 * these types outright when their required properties are missing. So the owner
 * says where each value lives.
 *
 * Two sources, mirroring how the SEO image already works: a CMS field on a
 * dynamic page (one binding covers every item in the collection), or a literal
 * value typed once for a standalone page.
 */

import type { CollectionItemWithValues } from '@/types';

export type SchemaBinding =
  | { type: 'field'; field_id: string }
  | { type: 'value'; value: string };

/** Bindings for one page, keyed by schema.org property name. */
export type SchemaBindings = Record<string, SchemaBinding>;

/** What a property expects, so the editor can show the right input. */
export type SchemaPropertyKind = 'text' | 'number' | 'date';

export interface SchemaPropertySpec {
  key: string;
  label: string;
  hint: string;
  kind: SchemaPropertyKind;
  /** When missing, the whole node is dropped rather than published incomplete. */
  required: boolean;
}

function isBinding(value: unknown): value is SchemaBinding {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.type === 'field') return typeof v.field_id === 'string' && v.field_id !== '';
  if (v.type === 'value') return typeof v.value === 'string';
  return false;
}

/**
 * Read the stored bindings, dropping anything malformed. A binding that has
 * lost its shape resolves to nothing, which drops its node — better than
 * publishing a property whose value is `[object Object]`.
 */
export function parseSchemaBindings(raw: unknown): SchemaBindings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: SchemaBindings = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isBinding(value)) out[key] = value;
  }
  return out;
}

/**
 * Resolve one property to a string, or null when it has no usable value.
 *
 * A field binding on a page with no collection item — a standalone page, or an
 * item that simply left the field empty — resolves to null, and the caller
 * decides whether that is fatal for the node.
 */
export function resolveBinding(
  binding: SchemaBinding | undefined,
  collectionItem: CollectionItemWithValues | null | undefined,
): string | null {
  if (!binding) return null;

  if (binding.type === 'value') {
    const trimmed = binding.value.trim();
    return trimmed || null;
  }

  const raw = collectionItem?.values?.[binding.field_id];
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

/** Resolve every property a type declares, keeping only the ones that landed. */
export function resolveProperties(
  specs: SchemaPropertySpec[],
  bindings: SchemaBindings,
  collectionItem: CollectionItemWithValues | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const spec of specs) {
    const value = resolveBinding(bindings[spec.key], collectionItem);
    if (value !== null) out[spec.key] = value;
  }
  return out;
}
