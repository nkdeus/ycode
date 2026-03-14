/**
 * Eva CSS — Intensity Override Utilities
 *
 * Generates global CSS rules that override the default Eva intensity
 * for specific Tailwind arbitrary classes. Per-class (not per-layer),
 * so overrides are stable regardless of layer ID changes.
 */

/** Maps a bare class name (e.g. "pb-[200px]") to an intensity suffix */
export type IntensityOverrides = Record<string, string>;

export const INTENSITY_MARKER_START = '/* eva-intensity-start */';
export const INTENSITY_MARKER_END = '/* eva-intensity-end */';
export const INTENSITY_MARKER_REGEX = new RegExp(
  `${escapeForRegex(INTENSITY_MARKER_START)}[\\s\\S]*?${escapeForRegex(INTENSITY_MARKER_END)}`,
  'g'
);

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Clean old layerId::className format entries, keep only bare className keys */
export function cleanOverrides(overrides: IntensityOverrides): IntensityOverrides {
  const cleaned: IntensityOverrides = {};
  for (const [key, value] of Object.entries(overrides)) {
    // Skip old format with "::" (layerId::className)
    if (key.includes('::')) continue;
    if (value) cleaned[key] = value;
  }
  return cleaned;
}

const ARBITRARY_PX_RE = /^([a-z]+-?(?:[a-z]+-)?)\[(\d+)px\](__?|-)?$/;

const PREFIX_TO_PROP: Record<string, string | string[]> = {
  'p-': 'padding', 'pt-': 'padding-top', 'pr-': 'padding-right',
  'pb-': 'padding-bottom', 'pl-': 'padding-left',
  'px-': ['padding-left', 'padding-right'],
  'py-': ['padding-top', 'padding-bottom'],
  'm-': 'margin', 'mt-': 'margin-top', 'mr-': 'margin-right',
  'mb-': 'margin-bottom', 'ml-': 'margin-left',
  'mx-': ['margin-left', 'margin-right'],
  'my-': ['margin-top', 'margin-bottom'],
  'gap-': 'gap', 'gap-x-': 'column-gap', 'gap-y-': 'row-gap',
  'w-': 'width', 'h-': 'height',
  'min-w-': 'min-width', 'min-h-': 'min-height',
  'max-w-': 'max-width', 'max-h-': 'max-height',
  'text-': 'font-size',
  'rounded-': 'border-radius',
  'top-': 'top', 'right-': 'right', 'bottom-': 'bottom', 'left-': 'left',
  'inset-': 'inset',
};

/** Escape characters that are special in CSS selectors */
function cssEscape(str: string): string {
  return str.replace(/([[\](){}|.+*?^$\\])/g, '\\$1');
}

/**
 * Generate global CSS rules for intensity overrides.
 * Key = bare class name (e.g. "pb-[200px]"), value = intensity suffix.
 *
 * Output example:
 *   .pb-\[200px\] { padding-bottom: var(--200__) !important }
 */
export function generateIntensityCSS(overrides: IntensityOverrides): string {
  const rules: string[] = [];

  for (const [className, intensity] of Object.entries(overrides)) {
    if (!intensity) continue;

    const m = className.match(ARBITRARY_PX_RE);
    if (!m) continue;

    const prefix = m[1];
    const size = parseInt(m[2], 10);
    const isFontSize = prefix === 'text-';

    // Font-sizes don't have a light (-) variant
    if (isFontSize && intensity === '-') continue;

    const props = PREFIX_TO_PROP[prefix];
    if (!props) continue;

    const varPrefix = isFontSize ? 'fs-' : '';
    const varName = `--${varPrefix}${size}${intensity}`;

    const escapedClass = cssEscape(className);
    const selector = `.${escapedClass}`;

    const propList = Array.isArray(props) ? props : [props];
    const declarations = propList.map(p => `${p}: var(${varName}) !important`).join('; ');

    rules.push(`${selector} { ${declarations} }`);
  }

  const body = rules.length > 0 ? `\n${rules.join('\n')}\n` : '\n';
  return `\n${INTENSITY_MARKER_START}${body}${INTENSITY_MARKER_END}`;
}
