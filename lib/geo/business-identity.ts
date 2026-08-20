/**
 * Business identity → schema.org Organization / LocalBusiness
 *
 * The one entity a generative engine most needs, and the one Ycode stores
 * nothing about: who runs this site, what they sell, where they operate. The
 * page-level nodes in `structured-data.ts` are all derivable from existing
 * data; this one is not, so it comes from a single `business_identity` setting
 * the site owner fills in.
 *
 * The setting holds plain business facts, not raw JSON-LD. Mapping them to
 * schema.org here keeps the output valid even when the person filling the form
 * has never read schema.org — and keeps a malformed paste from silently
 * shipping broken markup on every page.
 */

/** Schema types a site can legitimately claim without further evidence. */
const ORGANIZATION_TYPES = ['Organization', 'LocalBusiness', 'ProfessionalService'] as const;

export type BusinessType = typeof ORGANIZATION_TYPES[number];

export interface BusinessIdentity {
  type?: BusinessType;
  name?: string;
  legalName?: string;
  description?: string;
  telephone?: string;
  email?: string;
  logo?: string;
  streetAddress?: string;
  postalCode?: string;
  addressLocality?: string;
  addressRegion?: string;
  addressCountry?: string;
  /** Cities or regions served, e.g. ["Paris", "Lyon"]. */
  areaServed?: string[];
  /** Profile URLs that corroborate the entity: socials, directories, app stores. */
  sameAs?: string[];
  /** Free text, e.g. "49,99 € par mois ou 10 % des revenus". */
  priceRange?: string;
  /** Registration numbers: [{ name: "RCS Lyon", value: "944 768 027" }]. */
  identifiers?: { name: string; value: string }[];
}

function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed || undefined;
}

function strList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(str).filter((v): v is string => Boolean(v));
  return items.length ? items : undefined;
}

/**
 * Read the stored setting into a known shape.
 *
 * Unknown keys are dropped rather than passed through: this object is
 * serialized into every published page, and a typo'd key would ship as an
 * invalid schema.org property on the whole site.
 */
export function parseBusinessIdentity(raw: unknown): BusinessIdentity | null {
  let value = raw;

  if (typeof value === 'string') {
    if (!value.trim()) return null;
    try {
      value = JSON.parse(value);
    } catch {
      console.error('[geo] business_identity is not valid JSON — ignored');
      return null;
    }
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;

  const type = str(v.type);
  const identifiers = Array.isArray(v.identifiers)
    ? v.identifiers
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const e = entry as Record<string, unknown>;
        const name = str(e.name);
        const val = str(e.value);
        return name && val ? { name, value: val } : null;
      })
      .filter((e): e is { name: string; value: string } => e !== null)
    : undefined;

  return {
    type: ORGANIZATION_TYPES.includes(type as BusinessType) ? (type as BusinessType) : 'Organization',
    name: str(v.name),
    legalName: str(v.legalName),
    description: str(v.description),
    telephone: str(v.telephone),
    email: str(v.email),
    logo: str(v.logo),
    streetAddress: str(v.streetAddress),
    postalCode: str(v.postalCode),
    addressLocality: str(v.addressLocality),
    addressRegion: str(v.addressRegion),
    addressCountry: str(v.addressCountry),
    areaServed: strList(v.areaServed),
    sameAs: strList(v.sameAs),
    priceRange: str(v.priceRange),
    identifiers: identifiers?.length ? identifiers : undefined,
  };
}

/**
 * Build the organization node, or null when there isn't enough to say.
 *
 * A name is the minimum — an entity with no name identifies nobody. A
 * `LocalBusiness` additionally needs a locality: the whole point of the type is
 * that the business is somewhere, and one without an address is a claim search
 * engines will reject. Rather than emit a broken node, it degrades to
 * `Organization`.
 */
export function buildOrganizationNode(
  identity: BusinessIdentity | null,
  baseUrl: string,
  fallbackName?: string,
): Record<string, unknown> | null {
  if (!identity) return null;

  const name = identity.name || identity.legalName || fallbackName;
  if (!name) return null;

  const hasAddress = Boolean(identity.streetAddress || identity.addressLocality);
  const type = identity.type !== 'Organization' && !hasAddress ? 'Organization' : (identity.type || 'Organization');

  const node: Record<string, unknown> = {
    '@type': type,
    '@id': `${baseUrl}/#organization`,
    name,
    url: baseUrl,
  };

  if (identity.legalName && identity.legalName !== name) node.legalName = identity.legalName;
  if (identity.description) node.description = identity.description;
  if (identity.telephone) node.telephone = identity.telephone;
  if (identity.email) node.email = identity.email;
  if (identity.logo) node.logo = { '@type': 'ImageObject', url: identity.logo };
  if (identity.priceRange) node.priceRange = identity.priceRange;
  if (identity.sameAs) node.sameAs = identity.sameAs;

  if (hasAddress) {
    const address: Record<string, unknown> = { '@type': 'PostalAddress' };
    if (identity.streetAddress) address.streetAddress = identity.streetAddress;
    if (identity.postalCode) address.postalCode = identity.postalCode;
    if (identity.addressLocality) address.addressLocality = identity.addressLocality;
    if (identity.addressRegion) address.addressRegion = identity.addressRegion;
    if (identity.addressCountry) address.addressCountry = identity.addressCountry;
    node.address = address;
  }

  if (identity.areaServed) {
    node.areaServed = identity.areaServed.map((area) => ({ '@type': 'City', name: area }));
  }

  if (identity.identifiers) {
    node.identifier = identity.identifiers.map((id) => ({
      '@type': 'PropertyValue',
      name: id.name,
      value: id.value,
    }));
  }

  return node;
}
