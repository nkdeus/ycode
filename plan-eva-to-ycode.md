# Plan: Integrate eva-css-for-tailwind into Ycode

## Context

Ycode stores Tailwind arbitrary values (`text-[32px]`, `p-[24px]`) as static pixel values in the database. The `eva-css-for-tailwind` package generates a "bridge CSS" that overrides these classes with fluid `clamp()` values, making everything automatically responsive.

The package is already published on npm (`eva-css-for-tailwind@1.0.0`). It provides a modular API: `generateVars()`, `generateClassOverrides(classes)`, `generateClamp()`, `parseClass()`, `generateBridge()`.

**Key feature**: Per-class intensity suffixes (`p-[32px]__` = extreme, `p-[32px]_` = strong, `p-[32px]-` = light). No `data-eva` attributes needed.

**Goal**: Wire the package into ycode's CSS pipeline so all existing arbitrary values become fluid automatically, then add UI controls for per-layer intensity.

---

## Phase 1 — Pipeline Integration (foundation)

### Step 1.1 — Install package

```bash
npm install eva-css-for-tailwind
```

### Step 1.2 — Add Eva CSS to the app registry

**File**: `lib/apps/registry.ts`

Add a new `AppDefinition` entry:
```typescript
{
  id: 'eva-css',
  name: 'Eva CSS',
  description: 'Fluid responsive design — converts static pixel values to fluid clamp() values.',
  logo: evaCssLogo,  // need to add lib/apps/eva-css/logo.svg
  categories: ['popular'],
  implemented: true,
}
```

### Step 1.3 — Store Eva config and bridge CSS

**Storage strategy**: Use `app_settings` table (via `appSettingsRepository`) for Eva config, and `settings` table for bridge CSS (like `draft_css`/`published_css`).

Settings keys:
| Table | Key | Value |
|-------|-----|-------|
| `app_settings` (app_id: `eva-css`) | `config` | `{ sizes, fontSizes, screen, phi, ... }` |
| `app_settings` (app_id: `eva-css`) | `enabled` | `true/false` |
| `settings` | `eva_bridge_css` | Generated bridge CSS string |

Existing functions to reuse:
- `getAppSettingValue<T>('eva-css', 'config')` — `lib/repositories/appSettingsRepository.ts`
- `setAppSetting('eva-css', 'config', value)` — same file
- `setSetting('eva_bridge_css', css)` — `lib/repositories/settingsRepository.ts`
- `getSettingByKey('eva_bridge_css')` — same file

### Step 1.4 — Generate bridge CSS in the CSS pipeline

**File**: `lib/client/cssGenerator.ts`

Modify `generateAndSaveCSS()` to also generate Eva bridge CSS:

```typescript
export async function generateAndSaveCSS(layers: Layer[]): Promise<string> {
  const allLayers = await collectAllLayers(layers);
  const css = await generateCSS(allLayers);
  await saveCSS(css, 'draft_css');

  // --- NEW: Generate Eva bridge CSS ---
  await generateAndSaveEvaBridge(allLayers);

  return css;
}

async function generateAndSaveEvaBridge(layers: Layer[]): Promise<void> {
  try {
    // Check if Eva CSS is enabled
    const response = await fetch('/ycode/api/apps/eva-css/settings');
    const { data } = await response.json();
    if (!data?.enabled) return;

    const config = data.config || DEFAULT_EVA_CONFIG;

    // Extract arbitrary classes from layers
    const allClasses = extractClassesFromLayers(layers);
    const arbitraryClasses = [...allClasses].filter(cls => /\[\d+px\]/.test(cls));

    if (arbitraryClasses.length === 0) return;

    // Generate bridge CSS
    const { generateVars, generateClassOverrides } = await import('eva-css-for-tailwind');
    const vars = generateVars(config);
    const overrides = generateClassOverrides(arbitraryClasses);
    const bridgeCss = `/* Eva CSS Bridge — Fluid Design */\n${vars}\n${overrides}`;

    await saveCSS(bridgeCss, 'eva_bridge_css' as any);
  } catch (error) {
    console.error('[Eva CSS] Bridge generation failed:', error);
  }
}
```

Note: `saveCSS` currently only accepts `'draft_css' | 'published_css'`. Extend its type to also accept `'eva_bridge_css'`.

### Step 1.5 — Inject bridge CSS into editor canvas

**File**: `lib/canvas-utils.ts`

Add `<style id="eva-bridge"></style>` placeholder in the iframe template, after the Tailwind `<style>` block. This will be populated dynamically.

**File**: `app/ycode/components/Canvas.tsx`

After iframe initialization, fetch `eva_bridge_css` from settings store and inject it into the iframe's `<style id="eva-bridge">` element. Subscribe to settings changes to keep it updated.

### Step 1.6 — Inject bridge CSS into published/preview pages

**File**: `components/PageRenderer.tsx`

Add a new `evaBridgeCss` prop. Render after `ycode-styles`:

```tsx
{evaBridgeCss && (
  <style
    id="eva-bridge"
    dangerouslySetInnerHTML={{ __html: evaBridgeCss }}
  />
)}
```

**File**: `app/[...slug]/page.tsx`

Fetch `eva_bridge_css` alongside `published_css` in `fetchCachedGlobalSettings()`:
- Add `evaBridgeCss` to `GlobalPageSettings` interface
- Pass to `PageRenderer` as `evaBridgeCss` prop

**File**: `lib/generate-page-metadata.ts`

Add `eva_bridge_css` to the settings keys fetched in `fetchGlobalPageSettings()`.

**File**: `app/ycode/preview/[...slug]/page.tsx` (and `preview/page.tsx`)

Same pattern — fetch `eva_bridge_css` from settings, pass to PageRenderer.

### Step 1.7 — Sync bridge CSS on publish/revert

The bridge CSS is global (not draft/published split). It applies to both draft and published. No sync needed — same `eva_bridge_css` key used everywhere. If we want draft/published separation later, we can add `eva_bridge_published_css`.

---

## Phase 2 — App Settings UI

### Step 2.1 — Eva CSS app page in integrations

**File**: `app/ycode/integrations/apps/page.tsx` (modify existing)

When user clicks the Eva CSS app card, open a Sheet with:
1. **Toggle**: Enable/disable fluid CSS globally
2. **Sizes config**: Comma-separated input for spacing sizes (default: `4,8,12,16,24,32,48,64,96,128`)
3. **Font sizes config**: Comma-separated input for font sizes (default: `12,14,16,18,20,24,32,48`)
4. **Screen width**: Number input (default: `1440`)
5. **Default intensity**: Select dropdown (Extreme / Strong / Normal / Light)
6. **"Generate" button**: Calls API to generate + save bridge CSS
7. **Preview**: Show generated clamp example for a sample size

### Step 2.2 — Eva CSS API routes

**New file**: `app/ycode/api/apps/eva-css/generate/route.ts`

```typescript
// POST /ycode/api/apps/eva-css/generate
// Reads config from app_settings, generates bridge CSS, saves to settings
```

This route runs `generateVars()` + `generateClassOverrides()` server-side (the package has zero runtime deps, pure string generation).

To get the list of arbitrary classes server-side, query all `page_layers` and extract classes from the layers JSON.

---

## Phase 3 — Per-Layer Intensity Controls

### Step 3.1 — UI controls in design panel

Add an "Intensity" dropdown in these control components:
- `SpacingControls.tsx` — for padding/margin
- `TypographyControls.tsx` — for font-size
- `SizingControls.tsx` — for width/height
- `LayoutControls.tsx` — for gap

Options: `Auto` (default/normal) | `Light (-)` | `Strong (_)` | `Extreme (__)`

### Step 3.2 — Class suffix management

When intensity changes for a category, modify the Tailwind classes:
- Find all arbitrary pixel classes for that category (e.g., all `p-*`, `pt-*`, `pb-*` for spacing)
- Add/remove/change the intensity suffix

Example flow:
1. User has layer with class `pt-[32px]`
2. User selects "Strong" intensity for spacing
3. Class becomes `pt-[32px]_`
4. Bridge CSS already has `.pt-\[32px\]_ { padding-top: var(--32_) }`

This requires modifying the class generation logic in `use-design-sync.ts` to append intensity suffixes when Eva is enabled.

### Step 3.3 — Store intensity per layer

Add optional property to design categories in `types/index.ts`:

```typescript
interface SpacingDesign {
  // ... existing
  evaIntensity?: '' | '__' | '_' | '-';
}
interface TypographyDesign {
  // ... existing
  evaIntensity?: '' | '__' | '_' | '-';
}
// same for SizingDesign, LayoutDesign
```

---

## Files to modify (summary)

| File | Change |
|------|--------|
| `package.json` | Add `eva-css-for-tailwind` dependency |
| `lib/apps/registry.ts` | Add Eva CSS app definition |
| `lib/apps/eva-css/logo.svg` | New: app logo |
| `lib/client/cssGenerator.ts` | Add bridge CSS generation in `generateAndSaveCSS()` |
| `lib/canvas-utils.ts` | Add `<style id="eva-bridge">` placeholder |
| `app/ycode/components/Canvas.tsx` | Inject bridge CSS into iframe |
| `components/PageRenderer.tsx` | Add `evaBridgeCss` prop + `<style>` injection |
| `app/[...slug]/page.tsx` | Fetch + pass `eva_bridge_css` |
| `lib/generate-page-metadata.ts` | Add `evaBridgeCss` to `GlobalPageSettings` |
| `app/ycode/preview/*/page.tsx` | Fetch + pass `eva_bridge_css` |
| `app/ycode/integrations/apps/page.tsx` | Eva CSS settings Sheet UI |
| `app/ycode/api/apps/eva-css/generate/route.ts` | New: bridge generation API |
| `stores/useSettingsStore.ts` | No changes needed (generic) |
| `types/index.ts` | Add `evaIntensity` to design types (Phase 3) |
| `hooks/use-design-sync.ts` | Handle intensity suffixes (Phase 3) |
| `app/ycode/components/SpacingControls.tsx` | Intensity dropdown (Phase 3) |
| `app/ycode/components/TypographyControls.tsx` | Intensity dropdown (Phase 3) |
| `app/ycode/components/SizingControls.tsx` | Intensity dropdown (Phase 3) |
| `app/ycode/components/LayoutControls.tsx` | Intensity dropdown (Phase 3) |

---

## Verification

### Phase 1 testing
1. Install package, hardcode a default config
2. Create a test page with arbitrary values (`text-[32px]`, `p-[24px]`, `gap-[16px]`)
3. Save the page → verify `eva_bridge_css` is generated in settings
4. Open preview → inspect elements → verify `clamp()` values are applied
5. Publish → verify published page has `<style id="eva-bridge">` in `<head>`
6. Resize browser → verify fluid scaling works

### Phase 2 testing
1. Go to `/ycode/integrations/apps` → find Eva CSS card
2. Click → configure sizes, toggle on
3. Click Generate → verify bridge CSS updates
4. Toggle off → verify bridge CSS is not injected

### Phase 3 testing
1. Select a layer with `p-[32px]`
2. Change spacing intensity to "Strong"
3. Verify class becomes `p-[32px]_`
4. Preview → verify stronger fluid scaling
5. Change to "Extreme" → verify `p-[32px]__`
