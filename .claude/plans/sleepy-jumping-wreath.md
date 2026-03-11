# @eva-css/ycode — Package Spec & Todo

## Context

yCode generates Tailwind CSS from layer data stored in PostgreSQL. Classes like `text-[32px]`, `p-[24px]`, `gap-[48px]` are stored per layer and compiled via `@tailwindcss/browser` CDN at save time. The compiled CSS is persisted in a `settings` table (`draft_css` / `published_css`) and injected as a `<style>` tag on published pages.

The goal: make every pixel value in yCode **automatically fluid** using eva-css `clamp()` calculations, with intensity selection available directly in the yCode editor UI.

## Architecture

```
┌─────────────────────────────────────┐
│  @eva-css/ycode  (npm package)      │
│                                     │
│  Input:  eva.config sizes + fonts   │
│  Output: bridge.css                 │
│    → :root CSS vars (clamp)         │
│    → TW arbitrary class overrides   │
│    → data-eva intensity selectors   │
└────────────────┬────────────────────┘
                 │
        npm install + configure
                 │
┌────────────────▼────────────────────┐
│  yCode Integration (app: eva-css)   │
│                                     │
│  Settings UI:                       │
│    → sizes[], font_sizes[]          │
│    → default intensity              │
│    → generated bridge_css (stored)  │
│                                     │
│  Editor UI:                         │
│    → intensity selector per layer   │
│    → sets data-eva attribute        │
│                                     │
│  CSS injection:                     │
│    → bridge CSS appended after TW   │
│    → in cssGenerator iframe         │
│    → in PageRenderer <style>        │
└─────────────────────────────────────┘
```

## Part 1 — `@eva-css/ycode` package (eva-framework side)

### 1.1 Package setup

Create `packages/eva-ycode/` in the eva-framework monorepo.

```
packages/eva-ycode/
├── package.json          # @eva-css/ycode
├── src/
│   ├── index.ts          # Public API: generateBridge(config) → string
│   ├── generator.ts      # Core: sizes → CSS string
│   ├── clamp.ts          # Clamp math (extracted from _eva.scss)
│   └── types.ts          # Config & output types
├── cli.ts                # CLI: npx @eva-css/ycode generate
├── dist/                 # Compiled output
└── README.md
```

**package.json essentials:**
```json
{
  "name": "@eva-css/ycode",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "bin": { "eva-ycode": "dist/cli.js" },
  "exports": {
    ".": { "import": "./dist/index.mjs", "require": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./bridge.css": "./dist/bridge.css"
  },
  "peerDependencies": {},
  "dependencies": {}
}
```

Zero runtime dependencies. Pure CSS generation — no SCSS needed at runtime.

### 1.2 Config type

```typescript
interface EvaYcodeConfig {
  /** Spacing sizes in px (from Figma tokens) */
  sizes: number[];
  /** Font sizes in px (from Figma tokens) */
  fontSizes: number[];
  /** Reference screen width for fluid calc (default: 1440) */
  screen?: number;
  /** Golden ratio multiplier for spacing (default: 1.618) */
  phi?: number;
  /** Font ratio multiplier (default: 1.3) */
  fontPhi?: number;
  /** Min fluid factor (default: 0.5) */
  min?: number;
  /** Max fluid factor (default: 1) */
  max?: number;
}
```

### 1.3 CSS generation (`generator.ts`)

The generator produces a single CSS string with 3 sections:

#### Section A — CSS custom properties (`:root`)

For each size in `config.sizes` and `config.fontSizes`, generate 5 intensity variants:

```css
:root {
  /* Size 32 — all 5 intensities */
  --32--: clamp(1.11rem, 2.22vw + 0.56rem, 4.44rem);  /* max fluid */
  --32-:  clamp(1.33rem, 1.78vw + 0.89rem, 3.56rem);  /* strong */
  --32:   clamp(1.56rem, 1.33vw + 1.22rem, 2.67rem);  /* normal */
  --32_:  clamp(1.67rem, 0.89vw + 1.44rem, 2.22rem);  /* soft */
  --32__: clamp(1.78rem, 0.44vw + 1.67rem, 2rem);     /* minimal */

  /* Size 48 */
  --48--: clamp(...);
  --48-:  clamp(...);
  --48:   clamp(...);
  --48_:  clamp(...);
  --48__: clamp(...);

  /* ... repeat for all sizes and fontSizes */
}
```

**The clamp math must match exactly what `_eva.scss` produces.** Port the SCSS formula to TypeScript:

```typescript
function generateClamp(sizePx: number, screen: number, phi: number, min: number, max: number, intensity: Intensity): string {
  const percent = (sizePx / screen) * 100;
  // Apply intensity modifier using phi ratio
  // ... (port from _eva.scss getVW, getFinalMinRem, getMaxRem)
  return `clamp(${minRem}rem, ${vw}vw + ${offset}rem, ${maxRem}rem)`;
}
```

> **Critical**: The output must be identical to what eva-css produces for the same inputs. Write tests comparing against known eva-css outputs.

#### Section B — TW arbitrary class overrides (default intensity)

For each size, generate overrides for all TW arbitrary value patterns that yCode uses:

```css
/* ============================================
   Fluid overrides — default intensity: normal
   ============================================ */

/* --- 32px --- */
.text-\[32px\]   { font-size: var(--32) }
.h-\[32px\]      { height: var(--32) }
.w-\[32px\]      { width: var(--32) }
.min-h-\[32px\]  { min-height: var(--32) }
.min-w-\[32px\]  { min-width: var(--32) }
.max-w-\[32px\]  { max-width: var(--32) }
.p-\[32px\]      { padding: var(--32) }
.px-\[32px\]     { padding-inline: var(--32) }
.py-\[32px\]     { padding-block: var(--32) }
.pt-\[32px\]     { padding-top: var(--32) }
.pr-\[32px\]     { padding-right: var(--32) }
.pb-\[32px\]     { padding-bottom: var(--32) }
.pl-\[32px\]     { padding-left: var(--32) }
.m-\[32px\]      { margin: var(--32) }
.mx-\[32px\]     { margin-inline: var(--32) }
.my-\[32px\]     { margin-block: var(--32) }
.mt-\[32px\]     { margin-top: var(--32) }
.mr-\[32px\]     { margin-right: var(--32) }
.mb-\[32px\]     { margin-bottom: var(--32) }
.ml-\[32px\]     { margin-left: var(--32) }
.gap-\[32px\]    { gap: var(--32) }
.rounded-\[32px\] { border-radius: var(--32) }

/* --- 48px --- */
.text-\[48px\]   { font-size: var(--48) }
/* ... */
```

**Also handle `rem` variants** that yCode may use:
```css
.gap-\[1rem\]    { gap: var(--16) }   /* 1rem = 16px → map to --16 */
.py-\[3rem\]     { padding-block: var(--48) }  /* 3rem = 48px → map to --48 */
```

Only generate overrides for sizes that are in the config. If `32` is not in `config.sizes`, no override for `32px`.

#### Section C — Intensity selectors via `data-eva`

```css
/* ============================================
   Per-section intensity overrides
   ============================================ */

/* Max fluid (--) */
[data-eva="max"] .text-\[32px\]  { font-size: var(--32--) }
[data-eva="max"] .h-\[32px\]     { height: var(--32--) }
[data-eva="max"] .p-\[32px\]     { padding: var(--32--) }
[data-eva="max"] .pt-\[32px\]    { padding-top: var(--32--) }
/* ... all properties × all sizes */

/* Strong fluid (-) */
[data-eva="strong"] .text-\[32px\]  { font-size: var(--32-) }
/* ... */

/* Normal = default (no selector needed, section B covers it) */

/* Soft fluid (_) */
[data-eva="soft"] .text-\[32px\]  { font-size: var(--32_) }
/* ... */

/* Minimal fluid (__) */
[data-eva="min"] .text-\[32px\]  { font-size: var(--32__) }
/* ... */
```

**Naming map:**
| `data-eva` value | Eva suffix | Description |
|---|---|---|
| `max` | `--` | Maximum fluid range |
| `strong` | `-` | Strong fluid |
| *(default)* | *(none)* | Normal/balanced |
| `soft` | `_` | Soft fluid |
| `min` | `__` | Minimal fluid |

### 1.4 Public API (`index.ts`)

```typescript
export { generateBridge } from './generator';
export type { EvaYcodeConfig } from './types';

/**
 * Generate the complete bridge CSS string
 * @param config - Eva sizes and settings
 * @returns CSS string ready to inject
 */
export function generateBridge(config: EvaYcodeConfig): string;
```

### 1.5 CLI (`cli.ts`)

```bash
# Initialize config file in project root
npx @eva-css/ycode init
# → creates eva-ycode.config.cjs with default sizes

# Generate bridge.css from config
npx @eva-css/ycode generate
# → writes dist/bridge.css

# Generate and output to stdout (for piping)
npx @eva-css/ycode generate --stdout

# Generate with inline config (for yCode API to call)
npx @eva-css/ycode generate --sizes="4,8,16,24,32,48,64,96" --font-sizes="12,14,16,18,20,24,32,48"
```

### 1.6 Tests

- **Clamp accuracy**: For each size + intensity, compare output against known eva-css SCSS output
- **CSS validity**: Parse generated CSS, ensure no syntax errors
- **Override coverage**: Ensure every TW property pattern used by yCode is covered
- **Selector specificity**: `[data-eva] .class` must beat `.class` (it does, no `!important` needed)

### 1.7 Publish

```bash
pnpm build
npm publish --access public
```

Package: `@eva-css/ycode` on npm, under the `@eva-css` scope.

---

## Part 2 — yCode integration (yCode side)

> This is what gets built inside the yCode codebase. Documented here so you know what the package needs to support.

### 2.1 App registration

New app in `lib/apps/registry.ts`:
```typescript
{
  id: 'eva-css',
  name: 'Eva CSS',
  description: 'Fluid responsive design — auto-converts pixel values to clamp() using design tokens.',
  logo: evaCssLogo,
  categories: ['popular', 'other'],
  implemented: true,
}
```

New category added: `'design'` (for CSS/design tools).

### 2.2 App settings (stored in `app_settings` table)

| Key | Type | Description |
|---|---|---|
| `sizes` | `number[]` | `[4, 8, 12, 16, 24, 32, 48, 64, 96, 100, 120, 140]` |
| `font_sizes` | `number[]` | `[12, 14, 16, 18, 20, 24, 32, 48, 56]` |
| `screen` | `number` | Reference viewport width (default 1440) |
| `default_intensity` | `string` | `"normal"` |
| `bridge_css` | `string` | Generated CSS (output of `generateBridge()`) |
| `enabled` | `boolean` | Toggle fluid on/off globally |

### 2.3 Settings UI in apps page

When user clicks Eva CSS in `/ycode/integrations/apps`:

1. **Sizes input** — comma-separated numbers (pre-filled from Figma or manual)
2. **Font sizes input** — comma-separated numbers
3. **Screen width** — number input (default 1440)
4. **Default intensity** — select dropdown: Max / Strong / Normal / Soft / Minimal
5. **"Generate" button** — calls `generateBridge()` from `@eva-css/ycode`, saves result to `bridge_css` in app_settings
6. **Preview panel** — shows sample of generated CSS vars
7. **Toggle** — enable/disable globally

### 2.4 Editor UI — intensity per layer

In the **Attributes** section of the right sidebar (or a new "Eva CSS" section), when Eva CSS app is connected:

- **Select dropdown**: "Fluid intensity" → `Default / Max / Strong / Normal / Soft / Minimal`
- Sets `layer.attributes['data-eva']` = `"max"` | `"strong"` | `"soft"` | `"min"` | `undefined`
- The attribute renders as `data-eva="max"` on the HTML element
- "Default" means inherit from parent/global setting (no attribute set)

This is testable live in the editor because the bridge CSS is loaded in the canvas.

### 2.5 CSS injection points

**A. Editor canvas (draft preview)**

In `lib/client/cssGenerator.ts`, the iframe that generates CSS also needs the bridge CSS so the preview looks correct. The bridge CSS is loaded from `app_settings` and appended:

```html
<style type="text/tailwindcss">
  @custom-variant current (&[aria-current]);
  @custom-variant disabled (&:is(:disabled, [aria-disabled]));
</style>
<!-- Eva bridge CSS (from app_settings) -->
<style id="eva-bridge">${bridgeCss}</style>
```

**B. Published pages**

In `PageRenderer.tsx`, after the TW `<style id="ycode-styles">`, inject:

```tsx
{evaBridgeCss && (
  <style id="eva-bridge" dangerouslySetInnerHTML={{ __html: evaBridgeCss }} />
)}
```

The `evaBridgeCss` is fetched from `app_settings` (key: `bridge_css`, app_id: `eva-css`) at render time, alongside `published_css`.

**C. Save/publish flow**

The bridge CSS is **static** (doesn't change per page). It only regenerates when the user changes sizes config in the app settings. So it's fetched once and cached alongside `published_css`.

---

## Part 3 — Size of generated CSS (estimation)

For a typical config of **12 sizes × 20 properties × 5 intensities**:
- Section A (vars): ~60 lines (12 sizes × 5 vars)
- Section B (default overrides): ~240 lines (12 sizes × 20 properties)
- Section C (intensity overrides): ~960 lines (4 intensities × 12 sizes × 20 properties)
- **Total: ~1260 lines / ~30KB unminified / ~5KB gzipped**

Acceptable for a `<style>` injection.

---

## Part 4 — Summary checklist

### @eva-css/ycode package (eva-framework repo)

- [ ] Create `packages/eva-ycode/` in monorepo
- [ ] Port clamp math from `_eva.scss` to TypeScript (`clamp.ts`)
- [ ] Implement `generateBridge(config)` → CSS string (`generator.ts`)
  - [ ] Section A: `:root` vars with 5 intensities per size
  - [ ] Section B: TW arbitrary class overrides (default intensity)
  - [ ] Section C: `[data-eva]` intensity selectors
- [ ] Handle px AND rem arbitrary values mapping
- [ ] CLI: `init`, `generate`, `generate --stdout`, `generate --sizes=...`
- [ ] Write tests comparing clamp output against SCSS reference values
- [ ] Export types (`EvaYcodeConfig`)
- [ ] Build with tsup or similar (CJS + ESM + types)
- [ ] Publish as `@eva-css/ycode` on npm

### yCode integration (yCode repo — separate PR)

- [ ] Register `eva-css` app in `lib/apps/registry.ts`
- [ ] Create `lib/apps/eva-css/` module (types, logo)
- [ ] Settings UI in apps page (sizes, fonts, intensity, generate button)
- [ ] API route `app/ycode/api/apps/eva-css/generate` to call `generateBridge()`
- [ ] Inject bridge CSS in `cssGenerator.ts` iframe
- [ ] Inject bridge CSS in `PageRenderer.tsx`
- [ ] Add "Fluid intensity" selector in editor sidebar (sets `data-eva` attribute)
- [ ] Cache bridge CSS alongside `published_css` in page rendering
