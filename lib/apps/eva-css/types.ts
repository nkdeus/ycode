/**
 * Eva CSS Types & Defaults
 *
 * Standalone module — no core ycode files are modified.
 */

export interface EvaCssConfig {
  sizes: number[];
  fontSizes: number[];
  screen: number;
  defaultIntensity: '' | '__' | '_' | '-';
  /** Min ratio for spacing (0–1). Lower = smaller on mobile. Default 0.5 */
  min: number;
  /** Min ratio for font-sizes (0–1). Default 0.5 */
  fontMin: number;
  /** Ease-zone aggressiveness for extreme intensity. Default 142.4 */
  ez: number;
  /** Distribution curve for font-size intensities. Default 1.3 */
  fontPhi: number;
  /** Max ratio (1 = exact pixel value at screen width). Default 1 */
  max: number;
  /** Custom floor for extreme (__) clamp min, in rem. null = use default from `min`. */
  extremeFloor: number | null;
}

export const DEFAULT_EVA_CONFIG: EvaCssConfig = {
  sizes: [4, 8, 12, 16, 24, 32, 48, 64, 96, 128],
  fontSizes: [12, 14, 16, 18, 20, 24, 32, 48],
  screen: 1440,
  defaultIntensity: '',
  min: 0.5,
  fontMin: 0.5,
  ez: 142.4,
  fontPhi: 1.3,
  max: 1,
  extremeFloor: null,
};

/** Markers used to wrap Eva CSS inside custom_code_head */
export const EVA_MARKER_START = '<!-- eva-css-bridge-start -->';
export const EVA_MARKER_END = '<!-- eva-css-bridge-end -->';

/** Regex to find and strip the Eva block from custom_code_head */
export const EVA_MARKER_REGEX = new RegExp(
  `${EVA_MARKER_START}[\\s\\S]*?${EVA_MARKER_END}\\n?`,
  'g'
);

/** App ID used in the app_settings table */
export const EVA_APP_ID = 'eva-css';
