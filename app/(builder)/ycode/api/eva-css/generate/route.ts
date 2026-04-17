import {
  getAppSettingValue,
} from '@/lib/repositories/appSettingsRepository';
import {
  getSettingByKey,
  setSetting,
} from '@/lib/repositories/settingsRepository';
import { getAllDraftLayers } from '@/lib/repositories/pageLayersRepository';
import { getAllComponents } from '@/lib/repositories/componentRepository';
import { noCache } from '@/lib/api-response';
import {
  EVA_APP_ID,
  DEFAULT_EVA_CONFIG,
  EVA_MARKER_START,
  EVA_MARKER_END,
  EVA_MARKER_REGEX,
} from '@/lib/apps/eva-css/types';
import type { EvaCssConfig } from '@/lib/apps/eva-css/types';
import { generateIntensityCSS } from '@/lib/apps/eva-css/intensity';
import type { IntensityOverrides } from '@/lib/apps/eva-css/intensity';
import type { Layer } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively extract all classes from a layer tree */
function extractClasses(layers: Layer[]): Set<string> {
  const classes = new Set<string>();

  const addClasses = (value: string | string[] | undefined) => {
    if (!value) return;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (typeof item === 'string') {
        for (const cls of item.split(/\s+/)) {
          if (cls) classes.add(cls);
        }
      }
    }
  };

  const walk = (layer: Layer) => {
    addClasses(layer.classes);

    if (layer.textStyles) {
      for (const style of Object.values(layer.textStyles)) {
        addClasses((style as { classes?: string | string[] }).classes);
      }
    }

    if (layer.children) {
      for (const child of layer.children) {
        walk(child);
      }
    }
  };

  for (const layer of layers) walk(layer);
  return classes;
}

/** Wrap Eva bridge CSS in marker comments */
function wrapBridge(css: string): string {
  return `${EVA_MARKER_START}\n<style id="eva-bridge">\n${css}\n</style>\n${EVA_MARKER_END}\n`;
}

/** Strip existing Eva block from a custom code string */
function stripEvaBridge(code: string): string {
  return code.replace(EVA_MARKER_REGEX, '').trim();
}

// ---------------------------------------------------------------------------
// POST /ycode/api/eva-css/generate
// ---------------------------------------------------------------------------

/**
 * Generates Eva bridge CSS from all draft page layers + components,
 * stores it in settings, and injects it into custom_code_head.
 */
export async function POST() {
  try {
    // 1. Read config
    const config =
      (await getAppSettingValue<EvaCssConfig>(EVA_APP_ID, 'config')) ??
      DEFAULT_EVA_CONFIG;

    // 2. Gather all draft layers and component layers
    const [allPageLayers, components] = await Promise.all([
      getAllDraftLayers(),
      getAllComponents(false),
    ]);

    const allLayers: Layer[] = [];
    for (const pl of allPageLayers) {
      if (pl.layers) allLayers.push(...pl.layers);
    }
    for (const comp of components) {
      if (comp.layers) allLayers.push(...comp.layers);
    }

    // 3. Extract arbitrary pixel classes (e.g. text-[32px], p-[24px]__)
    const allClasses = extractClasses(allLayers);
    const arbitraryClasses = [...allClasses].filter((cls) =>
      /\[\d+px\]/.test(cls)
    );

    if (arbitraryClasses.length === 0) {
      // Clear any existing bridge
      await setSetting('eva_bridge_css', '');
      await clearCustomCodeHead();
      return noCache({
        data: {
          classCount: 0,
          bridgeCss: '',
          message: 'No arbitrary pixel classes found.',
        },
      });
    }

    // 4. Filter arbitrary classes: keep only those whose px value is in the
    //    user's config (sizes or fontSizes). Out-of-config classes fall
    //    through to Tailwind's native arbitrary-value generation — they
    //    render as literal pixels (non-fluid), as intended.
    const fontPrefixes = new Set(['text-']);
    const configSizes = new Set(config.sizes);
    const configFontSizes = new Set(config.fontSizes);

    const evaClasses = arbitraryClasses.filter((cls) => {
      const m = cls.match(/^([a-z]+-?(?:[a-z]+-)?)\[(\d+)px\]/);
      if (!m) return false;
      const px = parseInt(m[2], 10);
      return fontPrefixes.has(m[1])
        ? configFontSizes.has(px)
        : configSizes.has(px);
    });

    // 5. Generate bridge CSS from the user config only (dynamic import keeps
    //    the package tree-shakeable)
    const { generateVars, generateClassOverrides } = await import(
      'eva-css-for-tailwind'
    );
    let vars = generateVars(config) as string;
    const overrides = generateClassOverrides(evaClasses, config);

    // 5b. Post-process: custom extreme floor if configured
    if (config.extremeFloor != null && config.extremeFloor > 0) {
      const floor = config.extremeFloor;
      // Replace min value in all __ variable clamps:
      //   --200__: clamp(0.5rem, ...) → --200__: clamp(1rem, ...)
      vars = vars.replace(
        /(--[\w-]+__:\s*clamp\()[\d.]+rem/g,
        `$1${floor}rem`
      );
    }

    // 5c. Include per-class intensity overrides
    const intensityOverrides =
      (await getAppSettingValue<IntensityOverrides>(
        EVA_APP_ID,
        'intensity_overrides'
      )) ?? {};
    const intensityCss = generateIntensityCSS(intensityOverrides);

    const bridgeCss = `/* Eva CSS Bridge — Fluid Design */\n${vars}\n${overrides}${intensityCss}`;

    // 6. Persist bridge CSS in its own settings key
    await setSetting('eva_bridge_css', bridgeCss);

    // 7. Inject into custom_code_head (published pages render this SSR)
    await injectIntoCustomCodeHead(bridgeCss);

    const skipped = arbitraryClasses.length - evaClasses.length;
    return noCache({
      data: {
        classCount: evaClasses.length,
        skipped,
        bridgeCss,
        message:
          `Generated bridge CSS for ${evaClasses.length} in-config classes` +
          (skipped > 0 ? ` (${skipped} out-of-config left as static px).` : '.'),
      },
    });
  } catch (error) {
    console.error('[Eva CSS] Generation failed:', error);
    return noCache(
      {
        error:
          error instanceof Error ? error.message : 'Bridge generation failed',
      },
      500
    );
  }
}

// ---------------------------------------------------------------------------
// custom_code_head management
// ---------------------------------------------------------------------------

async function injectIntoCustomCodeHead(bridgeCss: string) {
  const current = ((await getSettingByKey('custom_code_head')) as string) || '';
  const cleaned = stripEvaBridge(current);
  const block = wrapBridge(bridgeCss);
  const updated = cleaned ? `${block}\n${cleaned}` : block;
  await setSetting('custom_code_head', updated);
}

async function clearCustomCodeHead() {
  const current = ((await getSettingByKey('custom_code_head')) as string) || '';
  const cleaned = stripEvaBridge(current);
  await setSetting('custom_code_head', cleaned || '');
}
