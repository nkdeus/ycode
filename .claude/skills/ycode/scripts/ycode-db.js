/* eslint-env node */
/* eslint-disable no-undef */
/**
 * Ycode DB Utility
 *
 * Centralizes all direct database operations for the /ycode skill.
 * Uses Knex + PostgreSQL via the Supabase pooler.
 *
 * Usage (CLI):
 *   node .claude/skills/ycode/scripts/ycode-db.js <command> [args...]
 *
 * Commands:
 *   list-pages
 *   get-layers <pageId>
 *   update-layers <pageId> <layersJsonFile>
 *   find-layer <pageId> <layerId>
 *   list-components
 *   create-component <name> <layersJsonFile>
 *   publish-page <pageId>
 *   dump-tree <pageId>
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// ---------------------------------------------------------------------------
// ENV parsing
// ---------------------------------------------------------------------------

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found at ' + envPath);
  }
  const vars = {};
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    line = line.replace(/\r$/, '');
    const idx = line.indexOf('=');
    if (idx > 0) {
      const key = line.substring(0, idx).trim();
      let val = line.substring(idx + 1).trim();
      val = val.replace(/^["']|["']$/g, '');
      vars[key] = val;
    }
  });
  return vars;
}

// ---------------------------------------------------------------------------
// DB connection
// ---------------------------------------------------------------------------

let _db = null;

function connect() {
  if (_db) return _db;
  const vars = loadEnv();

  // Parse connection URL if available, else fall back to individual vars
  const connUrl = vars.SUPABASE_CONNECTION_URL;
  let connConfig;

  if (connUrl) {
    const url = new URL(connUrl);
    connConfig = {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6543,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, '') || 'postgres',
      ssl: { rejectUnauthorized: false },
    };
  } else if (vars.SUPABASE_DB_PASSWORD) {
    connConfig = {
      host: 'aws-1-eu-west-1.pooler.supabase.com',
      port: 6543,
      user: 'postgres.dhbbgtyepofseaflmnkb',
      password: vars.SUPABASE_DB_PASSWORD,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    };
  } else {
    throw new Error('No Supabase connection URL or DB password found in .env');
  }

  const knex = require('knex');
  _db = knex({ client: 'pg', connection: connConfig });
  return _db;
}

async function disconnect() {
  if (_db) {
    await _db.destroy();
    _db = null;
  }
}

// ---------------------------------------------------------------------------
// ID generation (matches lib/utils.ts generateId)
// ---------------------------------------------------------------------------

function generateId(prefix = 'lyr') {
  const timestamp = Date.now().toString(36);
  const random = Math.floor(Math.random() * 36 ** 6).toString(36);
  return `${prefix}-${timestamp}${random}`;
}

function contentHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

async function listPages() {
  const db = connect();
  const pages = await db('pages')
    .select('id', 'name', 'slug', 'is_index', 'is_published', 'created_at', 'updated_at')
    .orderBy('created_at', 'asc');
  return pages;
}

async function getPage(pageId) {
  const db = connect();
  const rows = await db('pages').where('id', pageId).limit(1);
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

async function getPageLayers(pageId, { published = false } = {}) {
  const db = connect();
  const rows = await db('page_layers')
    .where('page_id', pageId)
    .where('is_published', published)
    .orderBy('created_at', 'desc')
    .limit(1);

  if (rows.length === 0) return null;
  return { id: rows[0].id, layers: rows[0].layers, content_hash: rows[0].content_hash };
}

async function updatePageLayers(pageId, layers) {
  const db = connect();
  const row = await db('page_layers')
    .where('page_id', pageId)
    .where('is_published', false)
    .orderBy('created_at', 'desc')
    .first();

  if (!row) throw new Error(`No draft layers found for page ${pageId}`);

  const hash = contentHash(layers);
  await db('page_layers')
    .where('id', row.id)
    .update({
      layers: JSON.stringify(layers),
      content_hash: hash,
      updated_at: new Date().toISOString(),
    });

  return { id: row.id, content_hash: hash };
}

// ---------------------------------------------------------------------------
// Layer tree utilities
// ---------------------------------------------------------------------------

function findLayer(layers, layerId) {
  for (const l of layers) {
    if (l.id === layerId) return l;
    if (l.children) {
      const found = findLayer(l.children, layerId);
      if (found) return found;
    }
  }
  return null;
}

function findLayerByName(layers, customName) {
  for (const l of layers) {
    if (l.customName === customName || l.name === customName) return l;
    if (l.children) {
      const found = findLayerByName(l.children, customName);
      if (found) return found;
    }
  }
  return null;
}

function findBody(layers) {
  return layers.find(l => l.name === 'body') || null;
}

function printTree(layers, depth = 0) {
  for (const l of layers) {
    const indent = '  '.repeat(depth);
    const label = l.customName ? ` "${l.customName}"` : '';
    const comp = l.componentId ? ` [component:${l.componentId}]` : '';
    console.log(`${indent}- ${l.id} <${l.name}>${label}${comp}`);
    if (l.children) printTree(l.children, depth + 1);
  }
}

/**
 * Assign fresh IDs to all layers in a tree (deep clone).
 * Returns idMap for interaction remapping.
 */
function assignFreshIds(layer) {
  const idMap = new Map();

  function walk(l) {
    const oldId = l.id;
    const newId = generateId('lyr');
    if (oldId) idMap.set(oldId, newId);
    l.id = newId;

    if (l.interactions) {
      l.interactions.forEach(interaction => {
        interaction.id = generateId('int');
        if (interaction.tweens) {
          interaction.tweens.forEach(tween => {
            tween.id = generateId('twn');
          });
        }
      });
    }

    if (l.children) l.children.forEach(walk);
  }

  walk(layer);

  // Second pass: remap interaction target layer_ids
  function remapInteractions(l) {
    if (l.interactions) {
      l.interactions.forEach(interaction => {
        if (interaction.tweens) {
          interaction.tweens.forEach(tween => {
            if (tween.layer_id && idMap.has(tween.layer_id)) {
              tween.layer_id = idMap.get(tween.layer_id);
            }
          });
        }
      });
    }
    if (l.children) l.children.forEach(remapInteractions);
  }

  remapInteractions(layer);
  return { layer, idMap };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

async function listComponents() {
  const db = connect();
  const components = await db('components')
    .select('id', 'name', 'is_published', 'created_at', 'updated_at')
    .orderBy('created_at', 'asc');
  return components;
}

async function getComponent(componentId) {
  const db = connect();
  const rows = await db('components').where('id', componentId).limit(1);
  return rows[0] || null;
}

async function createComponent(name, layers) {
  const db = connect();
  const id = crypto.randomUUID();
  const hash = contentHash(layers);

  await db('components').insert({
    id,
    name,
    layers: JSON.stringify(Array.isArray(layers) ? layers : [layers]),
    content_hash: hash,
    is_published: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return { id, content_hash: hash };
}

async function updateComponent(componentId, layers) {
  const db = connect();
  const hash = contentHash(layers);

  await db('components')
    .where('id', componentId)
    .update({
      layers: JSON.stringify(Array.isArray(layers) ? layers : [layers]),
      content_hash: hash,
      updated_at: new Date().toISOString(),
    });

  return { id: componentId, content_hash: hash };
}

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

async function publishPage(pageId) {
  const db = connect();

  // Get draft layers
  const draft = await db('page_layers')
    .where('page_id', pageId)
    .where('is_published', false)
    .orderBy('created_at', 'desc')
    .first();

  if (!draft) throw new Error(`No draft layers found for page ${pageId}`);

  // Upsert published layers
  const published = await db('page_layers')
    .where('page_id', pageId)
    .where('is_published', true)
    .first();

  if (published) {
    await db('page_layers')
      .where('id', published.id)
      .update({
        layers: draft.layers,
        content_hash: draft.content_hash,
        updated_at: new Date().toISOString(),
      });
  } else {
    await db('page_layers').insert({
      id: crypto.randomUUID(),
      page_id: pageId,
      layers: typeof draft.layers === 'string' ? draft.layers : JSON.stringify(draft.layers),
      content_hash: draft.content_hash,
      is_published: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return { published: true };
}

// ---------------------------------------------------------------------------
// Rich text helper
// ---------------------------------------------------------------------------

function richText(text) {
  return {
    data: {
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ text, type: 'text' }] }],
      },
    },
    type: 'dynamic_rich_text',
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  connect,
  disconnect,
  generateId,
  contentHash,
  listPages,
  getPage,
  getPageLayers,
  updatePageLayers,
  findLayer,
  findLayerByName,
  findBody,
  printTree,
  assignFreshIds,
  listComponents,
  getComponent,
  createComponent,
  updateComponent,
  publishPage,
  richText,
};

// ---------------------------------------------------------------------------
// CLI interface
// ---------------------------------------------------------------------------

async function cli() {
  const [,, command, ...args] = process.argv;

  if (!command) {
    console.log(`Usage: node ycode-db.js <command> [args...]

Commands:
  list-pages                        List all pages
  get-layers <pageId>               Get draft layers JSON for a page
  update-layers <pageId> <file>     Update draft layers from a JSON file
  find-layer <pageId> <layerId>     Find a specific layer in the tree
  dump-tree <pageId>                Print the layer tree
  list-components                   List all components
  create-component <name> <file>    Create a component from a JSON file
  publish-page <pageId>             Publish a page (copy draft to published)`);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'list-pages': {
        const pages = await listPages();
        console.log(JSON.stringify(pages, null, 2));
        break;
      }
      case 'get-layers': {
        const result = await getPageLayers(args[0]);
        if (!result) { console.log('No draft layers found'); break; }
        console.log(JSON.stringify(result.layers, null, 2));
        break;
      }
      case 'update-layers': {
        const layers = JSON.parse(fs.readFileSync(args[1], 'utf-8'));
        const result = await updatePageLayers(args[0], layers);
        console.log('Updated:', result);
        break;
      }
      case 'find-layer': {
        const data = await getPageLayers(args[0]);
        if (!data) { console.log('No draft layers found'); break; }
        const layer = findLayer(data.layers, args[1]);
        if (layer) console.log(JSON.stringify(layer, null, 2));
        else console.log('Layer not found:', args[1]);
        break;
      }
      case 'dump-tree': {
        const data = await getPageLayers(args[0]);
        if (!data) { console.log('No draft layers found'); break; }
        printTree(data.layers);
        break;
      }
      case 'list-components': {
        const components = await listComponents();
        console.log(JSON.stringify(components, null, 2));
        break;
      }
      case 'create-component': {
        const layers = JSON.parse(fs.readFileSync(args[1], 'utf-8'));
        const result = await createComponent(args[0], layers);
        console.log('Created component:', result);
        break;
      }
      case 'publish-page': {
        const result = await publishPage(args[0]);
        console.log('Published:', result);
        break;
      }
      default:
        console.error('Unknown command:', command);
        process.exit(1);
    }
  } finally {
    await disconnect();
  }
}

if (require.main === module) {
  cli().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}
