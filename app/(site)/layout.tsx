import '@/app/site.css';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import RootLayoutShell, { defaultMetadata } from '@/components/RootLayoutShell';
import { fetchGlobalPageSettings } from '@/lib/generate-page-metadata';
import { renderRootLayoutHeadCode } from '@/lib/parse-head-html';
import { getDefaultLocale } from '@/lib/repositories/localeRepository';

/**
 * Published default locale, for the server-rendered <html lang>.
 *
 * PageRenderer also sets `lang` on the content wrapper and syncs
 * document.documentElement from the client, but AI crawlers (GPTBot,
 * ClaudeBot, PerplexityBot…) don't run JavaScript — they only ever see what
 * the server sent. Without this the root element ships with no language at
 * all, and a French site reads as language-unknown to every extractor.
 *
 * Per-page locales still override this on the content wrapper; the root
 * attribute carries the site default, which is right for the vast majority of
 * requests and strictly better than nothing for the rest.
 */
const getPublishedDefaultLocaleCode = unstable_cache(
  async () => {
    try {
      const locale = await getDefaultLocale(true);
      return locale?.code || null;
    } catch {
      return null;
    }
  },
  ['site-default-locale-code'],
  { tags: ['all-pages'], revalidate: false },
);

export async function generateMetadata(): Promise<Metadata> {
  if (process.env.SKIP_SETUP === 'true') {
    return defaultMetadata;
  }

  try {
    const globalSettings = await fetchGlobalPageSettings();
    const metadata: Metadata = { ...defaultMetadata };

    if (globalSettings.faviconUrl || globalSettings.webClipUrl) {
      metadata.icons = {};
      if (globalSettings.faviconUrl) {
        metadata.icons.icon = globalSettings.faviconUrl;
      }
      if (globalSettings.webClipUrl) {
        metadata.icons.apple = globalSettings.webClipUrl;
      }
    }

    return metadata;
  } catch {
    return defaultMetadata;
  }
}

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let headElements: React.ReactNode[] = [];
  let lang: string | undefined;

  // Cloud mode uses ISR with explicit tenantId — calling headers() here
  // would force all pages dynamic. Cloud injects global head code from PageRenderer instead.
  if (process.env.SKIP_SETUP !== 'true') {
    try {
      const globalSettings = await fetchGlobalPageSettings();
      if (globalSettings.globalCustomCodeHead) {
        headElements = renderRootLayoutHeadCode(globalSettings.globalCustomCodeHead);
      }
    } catch {
      // Supabase not configured — skip custom code
    }

    lang = (await getPublishedDefaultLocaleCode()) || undefined;
  }

  // Published sites render text with the browser-default (`auto`) font
  // smoothing — matching legacy output. Forcing `antialiased` here would render
  // glyphs thinner/lighter than the original site.
  return (
    <RootLayoutShell
      headElements={headElements}
      bodyClassName="font-sans"
      lang={lang}
    >
      {children}
    </RootLayoutShell>
  );
}
