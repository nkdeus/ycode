import PageRenderer from '@/components/PageRenderer';
import { getAllComponents } from '@/lib/repositories/componentRepository';
import { resolveComponents } from '@/lib/resolve-components';
import { fetchGlobalPageSettings } from '@/lib/generate-page-metadata';
import type { Layer, Page } from '@/types';
import HelloMikaMount from './Subscribe';

export const revalidate = false;

export default async function CustomPage() {
  const components = await getAllComponents(true);
  const nav = components.find(c => c.name.toLowerCase() === 'nav');
  const footer = components.find(c => c.name.toLowerCase() === 'footer');

  const globalSettings = await fetchGlobalPageSettings();

  const navInstance: Layer | null = nav
    ? { id: 'nav-instance', name: 'div', classes: '', componentId: nav.id }
    : null;

  const footerInstance: Layer | null = footer
    ? { id: 'footer-instance', name: 'div', classes: '', componentId: footer.id }
    : null;

  const contentSection: Layer = {
    id: 'custom-content-layer',
    name: 'section',
    classes: 'min-h-[60vh]',
    attributes: { id: 'custom-content' },
    children: [],
  };

  const bodyLayer: Layer = {
    id: 'body',
    name: 'body',
    classes: 'bg-white',
    children: [
      ...(navInstance ? [navInstance] : []),
      contentSection,
      ...(footerInstance ? [footerInstance] : []),
    ],
  };

  const resolvedLayers = resolveComponents([bodyLayer], components);

  const page: Page = {
    id: 'custom-page',
    name: 'Custom Page',
    slug: 'custom-page',
    is_published: true,
    is_index: false,
    is_dynamic: false,
    page_folder_id: null,
    depth: 0,
    order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    content_hash: '',
    error_page: null,
    settings: {},
  } as Page;

  return (
    <>
      <PageRenderer
        page={page}
        layers={resolvedLayers}
        components={components}
        generatedCss={globalSettings.publishedCss || undefined}
        colorVariablesCss={globalSettings.colorVariablesCss || undefined}
        globalCustomCodeHead={globalSettings.globalCustomCodeHead}
        globalCustomCodeBody={globalSettings.globalCustomCodeBody}
        ycodeBadge={globalSettings.ycodeBadge}
      />
      <HelloMikaMount />
    </>
  );
}
