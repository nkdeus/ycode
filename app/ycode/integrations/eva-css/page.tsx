'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import type { EvaCssConfig } from '@/lib/apps/eva-css/types';
import { DEFAULT_EVA_CONFIG } from '@/lib/apps/eva-css/types';

// =============================================================================
// Types
// =============================================================================

interface EvaCssSettings {
  enabled: boolean;
  config: EvaCssConfig;
}

// =============================================================================
// Page Component
// =============================================================================

export default function EvaCssPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<EvaCssSettings>({
    enabled: false,
    config: DEFAULT_EVA_CONFIG,
  });
  const [lastResult, setLastResult] = useState<{
    classCount: number;
    message: string;
  } | null>(null);

  const [sizesInput, setSizesInput] = useState('');
  const [fontSizesInput, setFontSizesInput] = useState('');

  // =========================================================================
  // Load settings
  // =========================================================================

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await fetch('/ycode/api/eva-css/settings');
      const { data } = await res.json();
      if (data) {
        setSettings(data);
        setSizesInput(data.config.sizes.join(', '));
        setFontSizesInput(data.config.fontSizes.join(', '));
      }
    } catch {
      toast.error('Failed to load Eva CSS settings');
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================================================
  // Save & Generate
  // =========================================================================

  const parseNumbers = (input: string): number[] =>
    input
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);

  const buildConfig = (): EvaCssConfig => ({
    sizes: parseNumbers(sizesInput),
    fontSizes: parseNumbers(fontSizesInput),
    screen: settings.config.screen,
    defaultIntensity: settings.config.defaultIntensity,
    min: settings.config.min ?? DEFAULT_EVA_CONFIG.min,
    fontMin: settings.config.fontMin ?? DEFAULT_EVA_CONFIG.fontMin,
    ez: settings.config.ez ?? DEFAULT_EVA_CONFIG.ez,
    fontPhi: settings.config.fontPhi ?? DEFAULT_EVA_CONFIG.fontPhi,
    max: settings.config.max ?? DEFAULT_EVA_CONFIG.max,
    extremeFloor: settings.config.extremeFloor ?? null,
  });

  const handleSaveAndGenerate = async () => {
    setIsGenerating(true);
    setLastResult(null);
    try {
      const config = buildConfig();

      // Save settings
      const saveRes = await fetch('/ycode/api/eva-css/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: settings.enabled, config }),
      });
      const { error: saveError } = await saveRes.json();
      if (saveError) throw new Error(saveError);

      // Generate bridge CSS
      const genRes = await fetch('/ycode/api/eva-css/generate', {
        method: 'POST',
      });
      const { data, error: genError } = await genRes.json();
      if (genError) throw new Error(genError);

      setLastResult({
        classCount: data.classCount,
        message: data.message,
      });
      toast.success(data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  // =========================================================================
  // Live preview — fetch real clamp from server (debounced)
  // =========================================================================

  const [preview, setPreview] = useState<{
    size: number;
    clamps: Record<string, string>;
  } | null>(null);

  const previewTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchPreview = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try {
        const sizes = parseNumbers(sizesInput);
        const sampleSize = sizes[Math.min(5, sizes.length - 1)] ?? 32;
        const res = await fetch('/ycode/api/eva-css/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ size: sampleSize, config: buildConfig() }),
        });
        const { data } = await res.json();
        if (data) setPreview(data);
      } catch { /* silent */ }
    }, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizesInput, settings.config]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // =========================================================================
  // Render
  // =========================================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-6 space-y-8">
      {/* Back + Header */}
      <div>
        <Link
          href="/ycode/integrations/apps"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <Icon name="arrowLeft" className="size-3.5" />
          Back to apps
        </Link>
        <h1 className="text-lg font-semibold">Eva CSS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fluid responsive design — converts static pixel values to fluid
          clamp() values automatically.
        </p>
      </div>

      {/* Enable toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label className="text-sm font-medium">Enable Eva CSS</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inject fluid CSS overrides into published pages
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(checked) =>
            setSettings((s) => ({ ...s, enabled: checked }))
          }
        />
      </div>

      {/* Config section */}
      <div className="space-y-4">
        <h2 className="text-sm font-medium">Configuration</h2>

        {/* Sizes */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Spacing sizes (px, comma-separated)
          </Label>
          <Input
            value={sizesInput}
            onChange={(e) => setSizesInput(e.target.value)}
            placeholder="4, 8, 12, 16, 24, 32, 48, 64, 96, 128"
          />
        </div>

        {/* Font sizes */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Font sizes (px, comma-separated)
          </Label>
          <Input
            value={fontSizesInput}
            onChange={(e) => setFontSizesInput(e.target.value)}
            placeholder="12, 14, 16, 18, 20, 24, 32, 48"
          />
        </div>

        {/* Screen width */}
        <div className="space-y-1.5">
          <Label className="text-xs">Design screen width (px)</Label>
          <Input
            type="number"
            min={320}
            max={3840}
            value={settings.config.screen}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                config: { ...s.config, screen: parseInt(e.target.value, 10) || 1440 },
              }))
            }
          />
        </div>
      </div>

      {/* Live preview */}
      {preview && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <p className="text-xs font-medium">
            Preview for {preview.size}px
          </p>
          <div className="space-y-1 font-mono text-[11px]">
            {Object.entries(preview.clamps).map(([label, clamp]) => {
              const color =
                label === 'extreme' ? 'text-orange-400' :
                  label === 'strong' ? 'text-yellow-400' :
                    label === 'light' ? 'text-green-400' :
                      'text-blue-400';
              return (
                <div
                  key={label}
                  className="flex gap-2"
                >
                  <span className="text-muted-foreground w-16 shrink-0">{label}</span>
                  <span className={color}>{clamp}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Advanced config */}
      <details className="group">
        <summary className="text-sm font-medium cursor-pointer select-none flex items-center gap-1.5">
          <Icon
            name="chevronRight"
            className="size-4 transition-transform group-open:rotate-90"
          />
          Advanced
        </summary>
        <div className="mt-4 space-y-4 pl-5.5">
          <div className="grid grid-cols-2 gap-4">
            {/* Min ratio spacing */}
            <div className="space-y-1.5">
              <Label className="text-xs">Spacing min ratio</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={settings.config.min ?? DEFAULT_EVA_CONFIG.min}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    config: { ...s.config, min: parseFloat(e.target.value) || 0.5 },
                  }))
                }
              />
              <p className="text-[10px] text-muted-foreground">
                How small spacing shrinks on mobile (0 = vanishes, 1 = no change)
              </p>
            </div>

            {/* Min ratio font */}
            <div className="space-y-1.5">
              <Label className="text-xs">Font min ratio</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={settings.config.fontMin ?? DEFAULT_EVA_CONFIG.fontMin}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    config: { ...s.config, fontMin: parseFloat(e.target.value) || 0.5 },
                  }))
                }
              />
              <p className="text-[10px] text-muted-foreground">
                How small fonts shrink on mobile (0 = vanishes, 1 = no change)
              </p>
            </div>

            {/* Ease zone */}
            <div className="space-y-1.5">
              <Label className="text-xs">Ease zone (ez)</Label>
              <Input
                type="number"
                min={10}
                max={500}
                step={10}
                value={settings.config.ez ?? DEFAULT_EVA_CONFIG.ez}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    config: { ...s.config, ez: parseFloat(e.target.value) || 142.4 },
                  }))
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Extreme intensity aggressiveness (higher = more dramatic)
              </p>
            </div>

            {/* Font phi */}
            <div className="space-y-1.5">
              <Label className="text-xs">Font curve (fontPhi)</Label>
              <Input
                type="number"
                min={1}
                max={2}
                step={0.1}
                value={settings.config.fontPhi ?? DEFAULT_EVA_CONFIG.fontPhi}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    config: { ...s.config, fontPhi: parseFloat(e.target.value) || 1.3 },
                  }))
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Distribution curve between font intensity levels
              </p>
            </div>

            {/* Max ratio */}
            <div className="space-y-1.5">
              <Label className="text-xs">Max ratio</Label>
              <Input
                type="number"
                min={0.5}
                max={2}
                step={0.1}
                value={settings.config.max ?? DEFAULT_EVA_CONFIG.max}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    config: { ...s.config, max: parseFloat(e.target.value) || 1 },
                  }))
                }
              />
              <p className="text-[10px] text-muted-foreground">
                Max multiplier at design width (1 = exact pixel value)
              </p>
            </div>

            {/* Extreme floor */}
            <div className="space-y-1.5">
              <Label className="text-xs">Extreme floor (rem)</Label>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.25}
                value={settings.config.extremeFloor ?? ''}
                placeholder="auto"
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings((s) => ({
                    ...s,
                    config: {
                      ...s.config,
                      extremeFloor: val ? parseFloat(val) : null,
                    },
                  }));
                }}
              />
              <p className="text-[10px] text-muted-foreground">
                Fixed min for extreme — all __ clamps converge to this on mobile
              </p>
            </div>
          </div>
        </div>
      </details>

      {/* Action */}
      <Button
        onClick={handleSaveAndGenerate}
        disabled={isGenerating || !settings.enabled}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Spinner className="size-4 mr-2" />
            Generating...
          </>
        ) : (
          <>
            <Icon name="zap" className="size-4 mr-2" />
            Save &amp; Generate
          </>
        )}
      </Button>

      {/* Result */}
      {lastResult && (
        <div className="rounded-lg border bg-secondary/20 p-4 text-sm space-y-1">
          <p className="font-medium">{lastResult.message}</p>
          {lastResult.classCount > 0 && (
            <p className="text-xs text-muted-foreground">
              Bridge CSS injected into custom code head — visible on published pages.
            </p>
          )}
        </div>
      )}

      {/* How it works (collapsed) */}
      <details className="group">
        <summary className="text-xs text-muted-foreground cursor-pointer select-none flex items-center gap-1.5 hover:text-foreground transition-colors">
          <Icon
            name="chevronRight"
            className="size-3.5 transition-transform group-open:rotate-90"
          />
          How it works
        </summary>
        <div className="mt-3 rounded-lg border p-4 text-xs text-muted-foreground space-y-2">
          <ul className="space-y-1 list-disc pl-4">
            <li>
              Scans all page layers and components for arbitrary pixel classes
              (e.g. <code className="text-foreground">text-[32px]</code>,{' '}
              <code className="text-foreground">p-[24px]</code>)
            </li>
            <li>
              Generates CSS custom properties with fluid{' '}
              <code className="text-foreground">clamp()</code> values
            </li>
            <li>
              Injects class overrides into your global custom code head so
              published pages use responsive values instead of fixed pixels
            </li>
            <li>
              Re-generate after adding new pages or changing arbitrary values
            </li>
          </ul>
        </div>
      </details>
    </div>
  );
}
