/**
 * Font Utilities
 *
 * Shared utilities for building font CSS (Google Fonts @import, custom @font-face),
 * generating Tailwind-compatible class names, and font URL construction.
 */

import type { Font, FontAxis } from '@/types';

/** Built-in system fonts available without loading */
export const BUILT_IN_FONTS: Font[] = [
  {
    id: 'system-sans',
    name: 'sans',
    family: 'Sans Serif',
    type: 'default',
    variants: ['100', '200', '300', 'regular', '500', '600', '700', '800', '900'],
    weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
    category: 'sans-serif',
    is_published: false,
    created_at: '',
    updated_at: '',
    deleted_at: null,
  },
  {
    id: 'system-serif',
    name: 'serif',
    family: 'Serif',
    type: 'default',
    variants: ['regular', '700'],
    weights: ['400', '700'],
    category: 'serif',
    is_published: false,
    created_at: '',
    updated_at: '',
    deleted_at: null,
  },
  {
    id: 'system-mono',
    name: 'mono',
    family: 'Monospace',
    type: 'default',
    variants: ['regular', '700'],
    weights: ['400', '700'],
    category: 'monospace',
    is_published: false,
    created_at: '',
    updated_at: '',
    deleted_at: null,
  },
];

/** All available font weight values */
export const FONT_WEIGHTS = [
  { value: '100', label: 'Thin' },
  { value: '200', label: 'Extra Light' },
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semi Bold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra Bold' },
  { value: '900', label: 'Black' },
];

/** Allowed font file extensions */
export const ALLOWED_FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2'];
export const ALLOWED_FONT_MIME_TYPES = [
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2',
  'application/x-font-ttf',
  'application/x-font-otf',
  'application/font-woff',
  'application/font-woff2',
  'application/octet-stream', // Common fallback for font files
];

/**
 * Convert a font family name to a Tailwind-compatible class name.
 * e.g., "Open Sans" → "font-[Open_Sans]"
 */
export function getFontClassName(family: string): string {
  // Built-in font families use standard Tailwind classes
  if (family === 'Sans Serif' || family === 'sans') return 'font-sans';
  if (family === 'Serif' || family === 'serif') return 'font-serif';
  if (family === 'Monospace' || family === 'mono') return 'font-mono';

  // Custom/Google fonts use arbitrary value syntax with underscores
  const sanitized = family.replace(/\s+/g, '_');
  return `font-[${sanitized}]`;
}

/**
 * Convert a font family name to the value stored in layer.design.typography.fontFamily
 */
export function getFontFamilyValue(font: Font): string {
  if (font.type === 'default') {
    return font.name; // 'sans', 'serif', 'mono'
  }
  return font.family;
}

/**
 * Build a Google Fonts CSS2 API URL for a font.
 * Uses variable font range syntax with all axes (e.g. ital,opsz,wght@0,14..32,100..900)
 * when axis data is available. Falls back to weight-range detection, then individual weights.
 */
export function buildGoogleFontUrl(font: Font): string {
  const family = font.family.replace(/\s/g, '+');
  const variants = font.variants || [];
  const hasItalic = variants.some(v => v === 'italic' || v.endsWith('italic'));

  // Variable fonts: axes data includes wght range (and possibly opsz, wdth, etc.)
  const wghtAxis = font.axes?.find(a => a.tag === 'wght');
  if (wghtAxis) {
    return buildVariableFontUrl(
      family,
      { min: wghtAxis.start, max: wghtAxis.end },
      hasItalic,
      font.axes,
    );
  }

  // Derive weights from stored weights or variants
  const weights = font.weights?.length
    ? font.weights
    : extractWeightsFromVariants(variants);

  if (weights.length === 0) {
    return `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
  }

  const sortedWeights = [...new Set(weights)].sort();

  // Heuristic: contiguous weight range likely means variable font without axes data
  const weightRange = getContiguousWeightRange(sortedWeights);
  if (weightRange) {
    return buildVariableFontUrl(family, weightRange, hasItalic, font.axes);
  }

  // Static font: list individual weights
  if (hasItalic) {
    const tuples: string[] = [];
    for (const w of sortedWeights) tuples.push(`0,${w}`);
    for (const w of sortedWeights) tuples.push(`1,${w}`);
    return `https://fonts.googleapis.com/css2?family=${family}:ital,wght@${tuples.join(';')}&display=swap`;
  }

  return `https://fonts.googleapis.com/css2?family=${family}:wght@${sortedWeights.join(';')}&display=swap`;
}

/**
 * Build a variable font URL with all axes in alphabetical order.
 * Google Fonts CSS2 API requires axes listed alphabetically with matching
 * value tuples: e.g. ital,opsz,wght@0,14..32,100..900;1,14..32,100..900
 */
function buildVariableFontUrl(
  family: string,
  weightRange: { min: number; max: number },
  hasItalic: boolean,
  axes?: FontAxis[] | null,
): string {
  const extraAxes = (axes || [])
    .filter(a => a.tag !== 'wght' && a.tag !== 'ital')
    .sort((a, b) => a.tag.localeCompare(b.tag));

  const axisTags: string[] = [];
  const axisValues: string[] = [];

  if (hasItalic) axisTags.push('ital');

  for (const axis of extraAxes) {
    axisTags.push(axis.tag);
    axisValues.push(`${axis.start}..${axis.end}`);
  }

  axisTags.push('wght');
  axisValues.push(`${weightRange.min}..${weightRange.max}`);

  const axisSpec = axisTags.join(',');

  if (hasItalic) {
    const normalTuple = ['0', ...axisValues].join(',');
    const italicTuple = ['1', ...axisValues].join(',');
    return `https://fonts.googleapis.com/css2?family=${family}:${axisSpec}@${normalTuple};${italicTuple}&display=swap`;
  }

  const tuple = axisValues.join(',');
  return `https://fonts.googleapis.com/css2?family=${family}:${axisSpec}@${tuple}&display=swap`;
}

/** Extract numeric weights from variant names (e.g., "700italic" → "700", "regular" → "400") */
function extractWeightsFromVariants(variants: string[]): string[] {
  const weights = new Set<string>();
  for (const v of variants) {
    if (v === 'regular' || v === 'italic') {
      weights.add('400');
    } else if (!isNaN(Number(v))) {
      weights.add(v);
    } else {
      const match = v.match(/^(\d+)/);
      if (match) weights.add(match[1]);
    }
  }
  return Array.from(weights);
}

/**
 * Check if sorted weights form a contiguous range in steps of 100
 * (e.g. 100,200,...,900). Returns the range bounds or null for non-contiguous sets.
 * Variable fonts on Google Fonts expose a full contiguous range, while static
 * fonts typically list only a few discrete weights.
 */
function getContiguousWeightRange(
  sortedWeights: string[]
): { min: number; max: number } | null {
  const nums = sortedWeights
    .map(Number)
    .filter(n => !isNaN(n) && n >= 100 && n <= 900);

  if (nums.length < 3) return null;

  const min = nums[0];
  const max = nums[nums.length - 1];
  const expectedCount = (max - min) / 100 + 1;

  if (nums.length !== expectedCount) return null;

  for (let i = 1; i < nums.length; i++) {
    if (nums[i] - nums[i - 1] !== 100) return null;
  }

  return { min, max };
}

/**
 * Get available Tailwind weights for a font.
 * Variable fonts derive weights from the wght axis range.
 */
export function getFontAvailableWeights(font: Font): string[] {
  const wghtAxis = font.axes?.find(a => a.tag === 'wght');
  if (wghtAxis) {
    const weights: string[] = [];
    for (let w = Math.max(wghtAxis.start, 100); w <= Math.min(wghtAxis.end, 900); w += 100) {
      weights.push(String(w));
    }
    return weights;
  }

  if (font.weights && font.weights.length > 0) {
    return font.weights;
  }

  return extractWeightsFromVariants(font.variants || []);
}

/**
 * Map file extension to CSS @font-face format string
 */
export function mapExtensionToFontFormat(extension: string): string | null {
  switch (extension.toLowerCase()) {
    case 'eot': return 'embedded-opentype';
    case 'otf': return 'opentype';
    case 'ttf': return 'truetype';
    case 'woff': return 'woff';
    case 'woff2': return 'woff2';
    default: return null;
  }
}

/**
 * Build CSS for loading all installed fonts.
 * Generates @import rules for Google fonts and @font-face for custom fonts.
 */
export function buildFontsCss(fonts: Font[]): string {
  let css = '';

  for (const font of fonts) {
    if (font.type === 'google') {
      const url = buildGoogleFontUrl(font);
      css += `@import url('${url}');`;
    }

    if (font.type === 'custom' && font.url) {
      const family = font.family.replace(/"/g, '\\"');
      const format = font.kind || 'woff2';
      css += `@font-face {font-family: "${family}";src: url("${font.url}") format("${format}");font-display: swap;}`;
    }
  }

  return css;
}

/** Get Google Font stylesheet URLs for <link> elements (more reliable than @import) */
export function getGoogleFontLinks(fonts: Font[]): string[] {
  return fonts
    .filter(f => f.type === 'google')
    .map(f => buildGoogleFontUrl(f));
}

/**
 * Narrow each Google font's weights and italic variants to only what the
 * published CSS actually uses. Variable fonts on Google Fonts ship one woff2
 * per (style × axis-range) combination, so dropping unused italic variants
 * removes a whole font file and tightening the wght range can drop ~20–30%
 * of the binary size.
 *
 * Safe fallback: if we can't detect any `font-weight` rule in the CSS, the
 * font is returned untouched (better to over-fetch than break the page).
 */
export function narrowFontsToUsedWeights(fonts: Font[], css: string | undefined): Font[] {
  if (!css) return fonts;

  const usedWeights = new Set<number>();
  for (const m of css.matchAll(/font-weight\s*:\s*(\d{3})\b/g)) {
    const w = parseInt(m[1], 10);
    if (w >= 100 && w <= 900) usedWeights.add(w);
  }
  // No font-weight declarations found — leave fonts untouched.
  if (usedWeights.size === 0) return fonts;

  const usesItalic = /font-style\s*:\s*italic\b/.test(css);

  return fonts.map(font => {
    if (font.type !== 'google') return font;

    // Filter italic variants when no italics are used anywhere on the page.
    const filteredVariants = usesItalic
      ? font.variants
      : font.variants?.filter(v => v !== 'italic' && !v.endsWith('italic'));

    // Filter declared weights to the used set when discrete weights exist.
    const filteredWeights = font.weights?.filter(w => usedWeights.has(parseInt(w, 10)));

    // Tighten variable-font axes (wght range) to bracket the used weights.
    const usedSorted = Array.from(usedWeights).sort((a, b) => a - b);
    const minUsed = usedSorted[0];
    const maxUsed = usedSorted[usedSorted.length - 1];
    const filteredAxes = font.axes?.map(axis => {
      if (axis.tag !== 'wght') return axis;
      return {
        ...axis,
        start: Math.max(axis.start, minUsed),
        end: Math.min(axis.end, maxUsed),
      };
    });

    return {
      ...font,
      variants: filteredVariants && filteredVariants.length > 0 ? filteredVariants : font.variants,
      weights: filteredWeights && filteredWeights.length > 0 ? filteredWeights : font.weights,
      axes: filteredAxes,
    };
  });
}

/**
 * Modern Chrome User-Agent. Google Fonts varies its CSS response by UA —
 * sending a recent Chrome UA reliably returns woff2 with `unicode-range`
 * subset rules, which is what we want to inline.
 */
const MODERN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Fetch the resolved @font-face rules for the given Google Fonts CSS URLs and
 * return them as a single CSS string suitable for inlining in <style>.
 *
 * Inlining the CSS skips the round-trip to fonts.googleapis.com — the browser
 * can start fetching the woff2 binaries directly while parsing the document.
 *
 * Returns an empty string if any URL fails to fetch so the caller can fall
 * back to <link rel="stylesheet"> without partially breaking font loading.
 */
export async function fetchGoogleFontsCss(urls: string[]): Promise<string> {
  if (urls.length === 0) return '';

  try {
    const responses = await Promise.all(
      urls.map((url) =>
        fetch(url, {
          headers: { 'User-Agent': MODERN_UA },
          signal: AbortSignal.timeout(5000),
        }),
      ),
    );

    if (responses.some((r) => !r.ok)) return '';

    const cssBlocks = await Promise.all(responses.map((r) => r.text()));
    return cssBlocks.join('\n');
  } catch {
    return '';
  }
}

/**
 * Extract latin-subset woff2 URLs from inlined Google Fonts CSS so the caller
 * can emit `<link rel="preload" as="font" crossorigin>` tags ahead of the
 * Next.js CSS chunk that references the fonts.
 *
 * Without preloading, the critical request chain is:
 *   HTML → next.js CSS chunk → woff2 (gstatic)
 * because the @font-face rules in our inlined `<style>` are known at HTML
 * parse time, but the browser doesn't trigger the font fetch until a CSS
 * selector (in the next.js chunk) actually demands the family. PSI flagged
 * this on the EasyStay home: 416ms LCP-critical chain, 165ms of which was
 * the gap between the CSS chunk landing and the woff2 fetch starting.
 *
 * Latin filter: most pages render only ASCII text, so the browser fetches
 * only the latin subset of each @font-face declaration. Other subsets
 * (cyrillic, vietnamese, greek, latin-ext) are intentionally skipped to
 * avoid wasting bandwidth on bytes the page never paints.
 *
 * The list is also capped at `maxUrls` (default 4) — even after narrowing
 * to latin, a page using e.g. 4 weights × 2 italics still emits 8 URLs;
 * preloading them all would re-introduce the very bandwidth waste this
 * function is meant to avoid.
 */
export function extractLatinFontPreloads(css: string | undefined, maxUrls: number = 4): string[] {
  if (!css) return [];

  const urls: string[] = [];
  const seen = new Set<string>();
  const faceRegex = /@font-face\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = faceRegex.exec(css)) !== null) {
    const block = match[1];

    const unicodeRangeMatch = block.match(/unicode-range\s*:\s*([^;]+)/i);
    const unicodeRange = unicodeRangeMatch?.[1]?.trim() || '';

    // Latin subset markers: U+0020 (ASCII space, almost always present in
    // latin block), U+0000-00FF (Latin-1 supplement). A block with no
    // unicode-range covers the whole font (older Google Fonts CSS, custom
    // fonts) — treat as latin so we don't silently drop the only candidate.
    const isLatin = !unicodeRange
      || /U\+0000-00FF/i.test(unicodeRange)
      || /U\+0020/i.test(unicodeRange);
    if (!isLatin) continue;

    const srcMatch = block.match(/src\s*:\s*url\(\s*([^)\s]+)\s*\)/i);
    if (!srcMatch) continue;

    const url = srcMatch[1].replace(/^["']|["']$/g, '');
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);

    if (urls.length >= maxUrls) break;
  }

  return urls;
}

/** Build CSS for custom fonts only (@font-face rules, no @import) */
export function buildCustomFontsCss(fonts: Font[]): string {
  let css = '';

  for (const font of fonts) {
    if (font.type === 'custom' && font.url) {
      const family = font.family.replace(/"/g, '\\"');
      const format = font.kind || 'woff2';
      css += `@font-face {font-family: "${family}";src: url("${font.url}") format("${format}");font-display: swap;}`;
    }
  }

  return css;
}

/**
 * Build CSS class rules for font-family declarations.
 * Creates Tailwind-compatible CSS rules that map class names to font-family values.
 */
export function buildFontClassesCss(fonts: Font[]): string {
  let css = '';

  for (const font of fonts) {
    if (font.type === 'default') continue; // Built-in fonts handled by Tailwind defaults

    const { family, category } = font;
    const className = getFontClassName(family);

    let fontFamilyValue = `"${family}"`;
    if (category) {
      fontFamilyValue += `, ${category}`;
    }

    // Base class
    css += `.${escapeClassName(className)} { font-family: ${fontFamilyValue}; } `;

    // Pseudo-state variants
    const states = ['hover', 'focus', 'active', 'disabled', 'current'];
    for (const state of states) {
      css += `.${state}\\:${escapeClassName(className)}:${state} { font-family: ${fontFamilyValue}; } `;
    }
  }

  return css;
}

/**
 * Build complete font CSS (imports + class rules)
 */
export function buildAllFontsCss(fonts: Font[]): string {
  return buildFontsCss(fonts) + buildFontClassesCss(fonts);
}

/**
 * Escape CSS class name for use in selectors
 */
function escapeClassName(className: string): string {
  return className
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}
