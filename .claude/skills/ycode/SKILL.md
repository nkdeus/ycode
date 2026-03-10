---
name: ycode
description: Pilot the Ycode CMS - manage pages, layers, components, and layouts via natural language
argument-hint: [describe what you want to do]
---

# /ycode — Ycode CMS Pilot

You are now operating as the Ycode CMS pilot. You can manipulate pages, layers, components, and layouts directly through the database.

## Architecture Overview

Ycode stores page content as a **layer tree** in PostgreSQL (via Supabase):
- Table `page_layers`: stores `layers` JSON per page (draft and published versions)
- Table `components`: stores reusable component layer trees
- Table `pages`: page metadata (name, slug, is_homepage)

**Layer tree structure**: `body > section(s) > container/div > children`

The `body` layer is always the root. Sections are direct children of body. Each section typically contains a container div with max-width, which holds the actual content elements.

## Available Tools

### DB Utility Script

All operations go through: `.claude/skills/ycode/scripts/ycode-db.js`

**As a module** (preferred for complex operations):
```javascript
const ydb = require('./.claude/skills/ycode/scripts/ycode-db.js');

// List pages
const pages = await ydb.listPages();

// Get page layers
const data = await ydb.getPageLayers(pageId);
const layers = data.layers;

// Find the body layer
const body = ydb.findBody(layers);

// Find a specific layer by ID or name
const layer = ydb.findLayer(layers, 'lyr-xxx');
const hero = ydb.findLayerByName(layers, 'Hero Section');

// Update layers (auto-computes content_hash)
await ydb.updatePageLayers(pageId, layers);

// Components
const components = await ydb.listComponents();
const result = await ydb.createComponent('My Component', layerTree);

// Publish
await ydb.publishPage(pageId);

// Always disconnect when done
await ydb.disconnect();
```

**As CLI** (for quick operations):
```bash
node .claude/skills/ycode/scripts/ycode-db.js list-pages
node .claude/skills/ycode/scripts/ycode-db.js dump-tree <pageId>
node .claude/skills/ycode/scripts/ycode-db.js get-layers <pageId>
node .claude/skills/ycode/scripts/ycode-db.js find-layer <pageId> <layerId>
node .claude/skills/ycode/scripts/ycode-db.js list-components
node .claude/skills/ycode/scripts/ycode-db.js publish-page <pageId>
```

### Layout Templates

48 pre-built layout templates available via the app's template system. Reference: `.claude/skills/ycode/templates-reference.md`

Categories: Navigation (2), Hero (5), Header (4), Features (12), Blog Posts (6), Blog Header (4), Stats (3), Pricing (1), Team (2), Testimonials (5), FAQ (1), Footer (3).

## How to Perform Operations

### 1. List pages
```bash
node .claude/skills/ycode/scripts/ycode-db.js list-pages
```

### 2. Inspect a page's layer tree
```bash
node .claude/skills/ycode/scripts/ycode-db.js dump-tree <pageId>
```

### 3. Add a section to a page

Write a Node.js script that:
1. Requires `ycode-db.js`
2. Gets the page layers
3. Finds the body layer
4. Builds the new section layer tree (with fresh IDs via `ydb.generateId('lyr')`)
5. Inserts it into `body.children` at the desired position
6. Calls `ydb.updatePageLayers(pageId, layers)`
7. Disconnects

Example — add a features section after position 1:
```javascript
const ydb = require('./.claude/skills/ycode/scripts/ycode-db.js');

async function main() {
  const data = await ydb.getPageLayers('PAGE_ID');
  const layers = data.layers;
  const body = ydb.findBody(layers);

  const section = {
    id: ydb.generateId('lyr'),
    name: 'section',
    open: true,
    customName: 'Features Section',
    design: {
      layout: { display: 'Flex', isActive: true, alignItems: 'center', flexDirection: 'column' },
      spacing: { isActive: true, paddingTop: '80', paddingBottom: '80' },
    },
    classes: 'flex flex-col items-center w-[100%] pt-[80px] pb-[80px]',
    children: [
      {
        id: ydb.generateId('lyr'),
        name: 'div',
        open: true,
        design: {
          layout: { gap: '48px', display: 'Flex', isActive: true, flexDirection: 'column', alignItems: 'center' },
          sizing: { width: '100%', isActive: true, maxWidth: '1280px' },
          spacing: { isActive: true, paddingLeft: '32px', paddingRight: '32px' },
        },
        classes: 'flex flex-col gap-[48px] max-w-[1280px] w-[100%] items-center px-[32px]',
        children: [
          // Add content layers here...
        ],
      },
    ],
  };

  // Insert after first section (hero)
  body.children.splice(1, 0, section);
  await ydb.updatePageLayers('PAGE_ID', layers);
  await ydb.disconnect();
}
main();
```

### 4. Modify existing layer content

```javascript
const ydb = require('./.claude/skills/ycode/scripts/ycode-db.js');

async function main() {
  const data = await ydb.getPageLayers('PAGE_ID');
  const layers = data.layers;

  // Find by ID or name
  const heading = ydb.findLayerByName(layers, 'Hero Title');
  if (heading) {
    heading.variables.text = ydb.richText('New Heading Text');
  }

  await ydb.updatePageLayers('PAGE_ID', layers);
  await ydb.disconnect();
}
main();
```

### 5. Create a reusable component

```javascript
const ydb = require('./.claude/skills/ycode/scripts/ycode-db.js');

async function main() {
  const navLayer = { /* full layer tree */ };
  const result = await ydb.createComponent('Navigation', navLayer);
  console.log('Component ID:', result.id);

  // Then add instance to a page:
  const data = await ydb.getPageLayers('PAGE_ID');
  const body = ydb.findBody(data.layers);
  body.children.unshift({
    id: ydb.generateId('lyr'),
    name: 'div',
    open: true,
    customName: 'Navigation',
    componentId: result.id,
    classes: '',
    design: {},
  });

  await ydb.updatePageLayers('PAGE_ID', data.layers);
  await ydb.disconnect();
}
main();
```

### 6. Publish a page

```bash
node .claude/skills/ycode/scripts/ycode-db.js publish-page <pageId>
```

## Layer Generation Rules

When creating layers, ALWAYS follow these rules:

1. **Generate unique IDs**: Use `ydb.generateId('lyr')` for every layer.
2. **Set both `design` and `classes`**: They must be in sync. The `design` object is structured, `classes` is the Tailwind string.
3. **Mark design categories active**: Every design category used needs `isActive: true`.
4. **Use rich text format** for text content: `ydb.richText('Your text here')`.
5. **Standard section pattern**:
   ```
   section (full-width, flex-col, items-center, vertical padding)
     └─ div (container: max-w-1280, w-full, horizontal padding, flex-col, gap)
         └─ content children
   ```
6. **Responsive classes**: Add `max-md:` prefixed classes for mobile breakpoints.
7. **Image sources**: Use `/ycode/layouts/assets/` for bundled assets, or external URLs.
8. **Component instances**: Set `componentId` on the instance layer; the component's layer tree renders automatically.

## Workflow

1. **Always start by listing pages** to identify the target page ID.
2. **Dump the tree** to understand current structure before making changes.
3. **Write a Node.js script** for the operation (save as temp file, run with `node`).
4. **Verify** by dumping the tree again or checking the editor.
5. **Clean up** temp scripts after use.

When the user asks to do something, interpret their request, write the appropriate script, and execute it. Always show what you're doing and confirm the result.
