/* global document, window, fetch, console, setTimeout, setInterval, requestAnimationFrame,
   MutationObserver, HTMLInputElement, Event, CSS */
/**
 * Eva CSS — Chrome Extension Content Script
 *
 * 1. Fetches Eva config from /ycode/api/eva-css/settings
 * 2. Injects bridge CSS into the editor canvas iframe
 * 3. Constrains sizing inputs to Eva-configured values via datalists
 * 4. Adds per-layer intensity picker (override via CSS injection in canvas)
 */

(async function evaCssExtension() {
  'use strict';

  // ===========================================================================
  // Config
  // ===========================================================================

  let evaConfig = null;
  let bridgeCss = '';
  let enabled = false;
  let savedIntensityOverrides = {}; // layerId::className → suffix

  async function loadConfig() {
    try {
      const [settingsRes, bridgeRes, intensityRes] = await Promise.all([
        fetch('/ycode/api/eva-css/settings'),
        fetch('/ycode/api/settings/eva_bridge_css'),
        fetch('/ycode/api/eva-css/intensity'),
      ]);
      const { data: settings } = await settingsRes.json();
      const { data: css } = await bridgeRes.json();
      const { data: overrides } = await intensityRes.json();

      enabled = settings?.enabled ?? false;
      evaConfig = settings?.config ?? null;
      bridgeCss = typeof css === 'string' ? css : '';
      savedIntensityOverrides = overrides ?? {};

      if (enabled) {
        console.log('[Eva CSS] Config loaded:', evaConfig);
        console.log('[Eva CSS] Bridge CSS:', bridgeCss.length, 'chars');
        console.log('[Eva CSS] Intensity overrides:', Object.keys(savedIntensityOverrides).length);
      }
    } catch (err) {
      console.warn('[Eva CSS] Failed to load config:', err);
    }
  }

  await loadConfig();
  if (!enabled || !evaConfig) {
    console.log('[Eva CSS] Disabled or not configured — extension idle.');
    return;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  function getCanvasIframe() {
    return document.querySelector('iframe[title="Canvas Editor"]');
  }

  function getCanvasDoc() {
    const iframe = getCanvasIframe();
    return iframe?.contentDocument ?? null;
  }

  /** Currently selected layer (set by click listener in canvas) */
  let selectedLayerId = null;

  /** Get all classes on a layer element in the canvas */
  function getLayerClasses(layerId) {
    const doc = getCanvasDoc();
    if (!doc) return [];
    const el = doc.querySelector(`[data-layer-id="${layerId}"]`);
    if (!el) return [];
    return [...el.classList];
  }

  // ===========================================================================
  // 1. Inject bridge CSS into canvas iframe
  // ===========================================================================

  function injectBridgeCssIntoIframe() {
    if (!bridgeCss) return;

    const doc = getCanvasDoc();
    if (!doc) return;

    if (doc.getElementById('eva-bridge-ext')) return;

    const style = doc.createElement('style');
    style.id = 'eva-bridge-ext';
    style.textContent = bridgeCss;
    doc.head.appendChild(style);
    console.log('[Eva CSS] Bridge CSS injected into canvas.');
  }

  // ===========================================================================
  // 2. Suggest Eva values via a floating picker (no autocomplete filtering)
  // ===========================================================================
  //
  // Previous implementation used native <datalist>, which filters options as
  // the user types and only exposes values from the config. The new picker:
  //   - Always shows the FULL list of Eva values (no text-based filtering)
  //   - Never snaps / rewrites the user's value — custom px stay custom
  //   - Skips min-width / max-width / min-height / max-height inputs
  //     (identified by placeholder="Min" / "Max" in SizingControls.tsx)

  const KIND = { spacing: 'spacing', fontSizes: 'fontSizes' };

  function getValuesForKind(kind) {
    if (kind === KIND.fontSizes) return evaConfig.fontSizes;
    if (kind === KIND.spacing) return evaConfig.sizes;
    return null;
  }

  // ---- Floating picker singleton ------------------------------------------

  let evaPicker = null;
  let evaPickerInput = null;

  function ensurePicker() {
    if (evaPicker) return evaPicker;

    evaPicker = document.createElement('div');
    evaPicker.id = 'eva-value-picker';
    evaPicker.style.cssText = `
      position: fixed;
      z-index: 99998;
      display: none;
      flex-wrap: wrap;
      gap: 4px;
      padding: 6px;
      max-width: 260px;
      background: #1a1a2e;
      border: 1px solid #333;
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      font-family: system-ui, sans-serif;
      font-size: 11px;
    `;
    // Prevent blur-triggered close when clicking inside the panel
    evaPicker.addEventListener('mousedown', (e) => e.preventDefault());
    document.body.appendChild(evaPicker);
    return evaPicker;
  }

  function hidePicker() {
    if (evaPicker) evaPicker.style.display = 'none';
    evaPickerInput = null;
  }

  function showPickerFor(input, kind) {
    const values = getValuesForKind(kind);
    if (!values || values.length === 0) return;

    const panel = ensurePicker();
    evaPickerInput = input;
    panel.innerHTML = '';

    for (const v of values) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = String(v);
      chip.style.cssText = `
        padding: 3px 8px;
        border-radius: 4px;
        border: 1px solid #444;
        background: transparent;
        color: #ddd;
        font-family: monospace;
        font-size: 11px;
        cursor: pointer;
      `;
      chip.addEventListener('mouseenter', () => {
        chip.style.borderColor = '#6366f1';
        chip.style.color = '#fff';
      });
      chip.addEventListener('mouseleave', () => {
        chip.style.borderColor = '#444';
        chip.style.color = '#ddd';
      });
      chip.addEventListener('click', () => {
        const target = evaPickerInput;
        if (!target) return;
        const nativeSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype, 'value'
        ).set;
        nativeSetter.call(target, String(v));
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        target.focus();
      });
      panel.appendChild(chip);
    }

    // Position below the input
    const rect = input.getBoundingClientRect();
    panel.style.display = 'flex';
    const panelRect = panel.getBoundingClientRect();
    const left = Math.max(8, Math.min(
      window.innerWidth - panelRect.width - 8,
      rect.left
    ));
    const top = rect.bottom + 4;
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function attachDatalistsToInputs() {
    // Only suggest inputs in the editor, not on settings/integrations pages
    if (window.location.pathname.startsWith('/ycode/integrations/')) return;
    if (window.location.pathname.startsWith('/ycode/settings/')) return;

    const inputs = document.querySelectorAll(
      'input[data-slot="input"], input[data-slot="input-group-control"]'
    );

    for (const input of inputs) {
      if (input.dataset.evaProcessed) continue;

      const kind = resolveKindForInput(input);
      if (!kind) continue;

      input.dataset.evaProcessed = 'true';
      // Ensure native datalist cannot reappear for this input
      input.removeAttribute('list');

      input.addEventListener('focus', () => showPickerFor(input, kind));
      input.addEventListener('blur', () => {
        // Delay so chip clicks register before hide
        setTimeout(() => {
          if (evaPickerInput === input) hidePicker();
        }, 150);
      });
    }
  }

  function resolveKindForInput(input) {
    // Skip min-/max- sizing inputs — identified by their placeholder
    const placeholder = (input.getAttribute('placeholder') || '').trim();
    if (placeholder === 'Min' || placeholder === 'Max') return null;

    const context = getContextText(input).toLowerCase();

    if (context.includes('font') || context.includes('typography')) {
      const group = input.closest('[data-slot="input-group"]');
      if (group) return KIND.fontSizes;
    }

    if (
      context.includes('gap') ||
      context.includes('padding') ||
      context.includes('margin') ||
      context.includes('width') ||
      context.includes('height') ||
      context.includes('spacing') ||
      context.includes('layout')
    ) {
      return KIND.spacing;
    }

    return null;
  }

  function getContextText(input) {
    let node = input;
    const texts = [];
    for (let i = 0; i < 6; i++) {
      node = node.parentElement;
      if (!node) break;
      for (const el of node.querySelectorAll('label, h2, h3, h4, [class*="font-medium"]')) {
        texts.push(el.textContent || '');
      }
      for (const el of node.querySelectorAll('[title]')) {
        texts.push(el.getAttribute('title') || '');
      }
    }
    return texts.join(' ');
  }

  // ===========================================================================
  // 3. Intensity picker — inject CSS overrides per layer in canvas
  // ===========================================================================

  // Intensity levels with their class suffix and CSS var suffix
  const INTENSITIES = [
    { suffix: '__', label: 'Extreme', shortLabel: '++' },
    { suffix: '_',  label: 'Strong',  shortLabel: '+'  },
    { suffix: '',   label: 'Normal',  shortLabel: '='  },
    { suffix: '-',  label: 'Light',   shortLabel: '-'  },
  ];

  // Regex: matches arbitrary pixel classes like p-[24px], text-[32px], gap-[16px], etc.
  const ARBITRARY_PX_RE = /^([a-z]+-?(?:[a-z]+-)?)\[(\d+)px\](__?|-)?$/;

  // CSS property map for class prefixes → CSS property
  const PREFIX_TO_PROP = {
    'p-': 'padding', 'pt-': 'padding-top', 'pr-': 'padding-right',
    'pb-': 'padding-bottom', 'pl-': 'padding-left', 'px-': ['padding-left', 'padding-right'],
    'py-': ['padding-top', 'padding-bottom'],
    'm-': 'margin', 'mt-': 'margin-top', 'mr-': 'margin-right',
    'mb-': 'margin-bottom', 'ml-': 'margin-left', 'mx-': ['margin-left', 'margin-right'],
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

  /** Parse a class like "p-[24px]_" into { prefix, size, currentIntensity } */
  function parseArbitraryClass(cls) {
    const m = cls.match(ARBITRARY_PX_RE);
    if (!m) return null;
    return { prefix: m[1], size: parseInt(m[2], 10), currentIntensity: m[3] || '' };
  }

  /** Get the CSS variable name for a size + intensity + property type */
  function getVarName(size, intensity, isFontSize) {
    const prefix = isFontSize ? 'fs-' : '';
    return `--${prefix}${size}${intensity}`;
  }

  /**
   * Generate a global CSS rule that overrides an arbitrary class
   * to use a different intensity variable.
   * No layer ID — applies to ALL elements with this class.
   */
  function buildIntensityOverride(cls, targetIntensity) {
    const parsed = parseArbitraryClass(cls);
    if (!parsed) return '';

    const isFontSize = parsed.prefix === 'text-';

    // Font-sizes don't have a light (-) variant
    if (isFontSize && targetIntensity === '-') return '';

    const varName = getVarName(parsed.size, targetIntensity, isFontSize);
    const props = PREFIX_TO_PROP[parsed.prefix];
    if (!props) return '';

    // Use CSS.escape() for reliable selector escaping of brackets
    const escapedClass = CSS.escape(cls);
    const selector = `.${escapedClass}`;

    const propList = Array.isArray(props) ? props : [props];
    const declarations = propList.map(p => `${p}: var(${varName}) !important`).join('; ');

    return `${selector} { ${declarations} }`;
  }

  // ---------------------------------------------------------------------------
  // Intensity picker UI (floating panel in the editor)
  // ---------------------------------------------------------------------------

  let pickerEl = null;
  let currentPickerLayerId = null;

  function createPicker() {
    if (pickerEl) return pickerEl;

    pickerEl = document.createElement('div');
    pickerEl.id = 'eva-intensity-picker';
    pickerEl.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 99999;
      background: #1a1a2e;
      border: 1px solid #333;
      border-radius: 10px;
      padding: 10px 14px;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      color: #e0e0e0;
      display: none;
      flex-direction: column;
      gap: 6px;
      max-width: 420px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 11px; color: #a0a0ff; text-transform: uppercase; letter-spacing: 0.05em;';
    header.textContent = 'Eva — Intensity';
    pickerEl.appendChild(header);

    // Content container (rows will be added here)
    const content = document.createElement('div');
    content.id = 'eva-picker-content';
    content.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
    pickerEl.appendChild(content);

    document.body.appendChild(pickerEl);
    return pickerEl;
  }

  /** Build the picker content for the currently selected layer */
  function updatePicker() {
    const layerId = selectedLayerId;

    if (!layerId || layerId === 'body') {
      if (pickerEl) pickerEl.style.display = 'none';
      currentPickerLayerId = null;
      return;
    }

    // Get classes from the canvas element
    const classes = getLayerClasses(layerId);
    const arbitraryClasses = classes.filter(cls => ARBITRARY_PX_RE.test(cls));

    if (arbitraryClasses.length === 0) {
      if (pickerEl) pickerEl.style.display = 'none';
      currentPickerLayerId = null;
      return;
    }

    createPicker();
    currentPickerLayerId = layerId;

    const content = document.getElementById('eva-picker-content');
    content.innerHTML = '';

    for (const cls of arbitraryClasses) {
      const parsed = parseArbitraryClass(cls);
      if (!parsed) continue;

      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; gap: 6px;';

      // Class label
      const label = document.createElement('span');
      label.style.cssText = 'color: #999; font-size: 11px; min-width: 100px; font-family: monospace;';
      label.textContent = `${parsed.prefix}[${parsed.size}px]`;
      row.appendChild(label);

      // Intensity buttons (font-sizes have no light/- variant)
      const isFontSize = parsed.prefix === 'text-';
      for (const intensity of INTENSITIES) {
        if (isFontSize && intensity.suffix === '-') continue;

        const btn = document.createElement('button');
        // Check saved overrides first, then fall back to class suffix
        const savedSuffix = savedIntensityOverrides[cls];
        const activeIntensity = savedSuffix !== undefined ? savedSuffix : parsed.currentIntensity;
        const isActive = activeIntensity === intensity.suffix;
        btn.style.cssText = `
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid ${isActive ? '#6366f1' : '#444'};
          background: ${isActive ? '#6366f1' : 'transparent'};
          color: ${isActive ? '#fff' : '#aaa'};
          font-size: 11px;
          cursor: pointer;
          font-family: monospace;
          transition: all 0.15s;
        `;
        btn.textContent = intensity.shortLabel;
        btn.title = `${intensity.label} (${intensity.suffix || 'default'})`;

        btn.addEventListener('mouseenter', () => {
          if (!isActive) btn.style.borderColor = '#6366f1';
        });
        btn.addEventListener('mouseleave', () => {
          if (!isActive) btn.style.borderColor = '#444';
        });

        btn.addEventListener('click', () => {
          applyIntensityOverride(cls, intensity.suffix);
          updatePicker(); // refresh active state
        });

        row.appendChild(btn);
      }

      content.appendChild(row);
    }

    pickerEl.style.display = 'flex';
  }

  // ---------------------------------------------------------------------------
  // Apply intensity overrides via CSS injection in canvas iframe
  // ---------------------------------------------------------------------------

  /** Track active overrides locally for immediate visual feedback */
  const localOverrides = {};

  /**
   * Apply intensity override (per-class, global — no layer ID dependency):
   * 1. Inject CSS into canvas iframe for immediate visual feedback
   * 2. Persist to server via API (lightweight save, no regeneration)
   *
   * The overrides are baked into bridge CSS when the user clicks "Generate"
   * in Eva CSS settings. In the editor, the local CSS injection handles
   * the visual preview instantly.
   */
  function applyIntensityOverride(cls, targetIntensity) {
    const doc = getCanvasDoc();
    if (!doc) return;

    // --- Immediate visual feedback in canvas ---
    let overrideStyle = doc.getElementById('eva-intensity-overrides');
    if (!overrideStyle) {
      overrideStyle = doc.createElement('style');
      overrideStyle.id = 'eva-intensity-overrides';
      doc.head.appendChild(overrideStyle);
    }

    const parsed = parseArbitraryClass(cls);
    if (!parsed) return;

    const isReset = targetIntensity === parsed.currentIntensity || targetIntensity === '';

    if (isReset) {
      delete localOverrides[cls];
      delete savedIntensityOverrides[cls];
    } else {
      localOverrides[cls] = buildIntensityOverride(cls, targetIntensity);
      savedIntensityOverrides[cls] = targetIntensity;
    }

    const cssText = Object.values(localOverrides).filter(Boolean).join('\n');
    overrideStyle.textContent = cssText;

    console.log(`[Eva CSS] Intensity: ${cls} → ${targetIntensity || 'normal'} (global)`);

    // --- Persist to server (fire-and-forget) ---
    fetch('/ycode/api/eva-css/intensity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        className: cls,
        intensity: isReset ? '' : targetIntensity,
      }),
    }).catch(err => console.warn('[Eva CSS] Failed to persist intensity:', err));
  }

  // ===========================================================================
  // 4. MutationObserver — run on DOM changes
  // ===========================================================================

  // Throttled DOM observer — attaches the Eva picker to new inputs.
  // No .closest() calls in the callback to avoid forced reflows.
  let observerTimeout = null;
  const observer = new MutationObserver(() => {
    if (observerTimeout) return;
    observerTimeout = setTimeout(() => {
      observerTimeout = null;
      attachDatalistsToInputs();
    }, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false,
  });

  // Watch for clicks in the canvas iframe to detect layer selection.
  // Uses mouseup (not click) on bubble phase to avoid interfering with
  // Ycode's own click handling that caused "Impossible de trouver le nœud".
  function watchCanvasClicks() {
    const doc = getCanvasDoc();
    if (!doc) return;

    if (doc._evaClickWatching) return;
    doc._evaClickWatching = true;

    doc.addEventListener('mouseup', (e) => {
      const layerEl = e.target.closest('[data-layer-id]');
      if (layerEl) {
        selectedLayerId = layerEl.getAttribute('data-layer-id');
      } else {
        selectedLayerId = null;
      }
      // Defer picker update so it never blocks Ycode's event handlers
      requestAnimationFrame(() => updatePicker());
    }); // bubble phase — runs AFTER Ycode's handlers

    console.log('[Eva CSS] Watching canvas clicks (mouseup, bubble phase).');
  }

  // Periodically check for canvas iframe (it may load late or reload)
  setInterval(() => {
    const iframe = getCanvasIframe();
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    injectBridgeCssIntoIframe();
    watchCanvasClicks();
  }, 2000);

  // Initial run
  injectBridgeCssIntoIframe();
  attachDatalistsToInputs();

  console.log('[Eva CSS] Extension active with intensity picker.');
})();
