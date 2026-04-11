# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ycode is a self-hosted visual website builder built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, and Supabase (PostgreSQL + Auth). State management uses Zustand. UI primitives are ShadCN (Radix-based) in `components/ui/`.

## Commands

```bash
npm run dev              # Dev server on port 3002
npm run build            # Production build
npm run lint             # ESLint
npm run lint:fix         # ESLint with auto-fix
npm run type-check       # TypeScript type checking (tsc --noEmit)
npm run migrate:latest   # Run pending database migrations
npm run migrate:make -- migration_name  # Create new migration
npm run migrate:rollback # Rollback last migration batch
```

No test framework is configured — quality checks are `lint` and `type-check`.

## Architecture

### App Router Structure (`app/`)

- `app/ycode/` — Authenticated editor UI (dashboard, page editor, collections, settings, etc.)
- `app/ycode/api/` — Backend API routes (auth, pages, components, collections, assets, etc.)
- `app/[...slug]/` — Dynamic rendering of published pages
- `app/api/` — Public API routes (page-auth, templates)

### Key Directories

- **`components/`** — React components. `components/ui/` holds ShadCN primitives.
- **`hooks/`** — Custom React hooks (undo/redo, editor URL sync, design sync, live data, canvas interactions).
- **`stores/`** — Zustand stores (editor state, pages, components, collections, assets, layer styles, etc.).
- **`lib/`** — Utilities and business logic:
  - `lib/repositories/` — Data access layer (pageRepository, collectionRepository, etc.)
  - `lib/services/` — Business logic layer (pageService, collectionService, etc.)
  - `lib/api.ts` — Main API client
  - `lib/page-fetcher.ts` — Page data fetching
  - `lib/layer-utils.ts` — Layer manipulation utilities
- **`types/`** — TypeScript type definitions (`types/index.ts` is the central export)
- **`database/migrations/`** — Knex migrations (PostgreSQL)

### Data Flow

API-first: all data goes through `lib/api.ts` → API routes in `app/ycode/api/` → repositories → Supabase. Real-time updates use Supabase subscriptions. Next.js `unstable_cache` with tag-based revalidation handles caching.

### Key Systems

- **LayerRenderer** (`components/LayerRenderer.tsx`) — Main canvas renderer
- **PageRenderer** (`components/PageRenderer.tsx`) — Published page renderer
- **Undo/Redo** — History stack in `useUndoRedoStore` with layer snapshots
- **Drag & Drop** — dnd-kit for canvas and layer tree interactions
- **Rich Text** — TipTap editor with extensions
- **Animations** — GSAP + React Spring

## Code Conventions

### ShadCN Components Are Mandatory

All UI primitives (buttons, inputs, selects, dropdowns, tooltips, etc.) **must** use ShadCN components from `components/ui/`. Never write raw `<button>` or `<input>` elements. Extend via composition, not custom implementations.

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Icon } from '@/components/ui/icon';  // Lucide icons wrapper
```

### Style Rules (enforced by ESLint)

- 2-space indentation
- Single quotes (allow escape and template literals)
- Spaced object braces: `{ key: value }`
- Max 2 JSX props per line; closing bracket tag-aligned
- No trailing empty lines

### Commit Messages

Format: `<type>: <imperative summary>` (max 50 chars)

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `perf`, `test`

Body (optional): explain WHY, not what. No AI attribution. No filler words.

### Pull Requests

- **Base branch: `develop`** (not main)
- Title follows commit format
- Body: Summary, Changes (bullet list), Test plan (mandatory checklist)
- Link issues: `Closes #123`

## Path Alias

`@/*` maps to the project root (e.g., `@/components/ui/button`, `@/lib/api`).

## Environment

Requires `.env.local` with Supabase credentials — see `.env.example`. Database is PostgreSQL via Supabase. Migrations use Knex (`knexfile.ts`).

## YCode MCP — Site Building Best Practices

When building pages via the YCode MCP tools, follow these rules:

### Structure
- **All sections must be inside `body`** — never leave sections at root level. Use `move_layer` if `add_layout` places them outside body.
- **Always name sections** — use `update_layer_settings` with `custom_name` on every section/layout added (e.g., "Navigation", "Hero", "Stats Bar", "Features", "Footer").
- **Use native layouts first** — always check `list_layouts` and use pre-built templates (navigation, hero, stats, features, FAQ, footer, etc.) before building from scratch.
- **Figma is reference only** — use Figma (`get_design_context`) to extract text content and understand layout intent, not for pixel-perfect replication.

### Colors & Design Tokens
- **Always use project color variables** — check `list_color_variables` and reference them via `color:var(--<variable-id>)` instead of hardcoded hex values.
- **Clean up template defaults** — native layouts come with default backgrounds, padding, and borders. Remove or adapt them to match the project design.
- **Set `isActive: true`** on any design category you apply. Set `isActive: false` to disable a category (e.g., remove unwanted backgrounds).

### Styles
- **Clear local design before applying a style** — before `apply_style`, use `update_layer_design` to reset the same design categories (set values to `""` and `isActive: false`) so local classes don't conflict with the style.
- **Name styles lowercase, no spaces** — use kebab-case (e.g., `stat-number`, `card-title`), not `Stat Number`.

### Layers
- **Leaf elements cannot have children** — text, image, icon, video, input are leaf nodes.
- **Sections cannot contain other sections** — use div for nested containers.
- **Use semantic tags** — set `tag: "nav"` for navigation, `tag: "footer"` for footer, `tag: "h1"`-`h6"` for headings via `update_layer_settings`.

### Assets
- **Upload assets to YCode** — use `upload_asset` to import images from Figma URLs, then reference via `update_layer_image` with the returned `asset_id`.
- **SVG logos** — get them from Figma via `get_design_context` which returns asset URLs, then upload to YCode.

### Workflow
1. `list_layouts` — pick the closest native layout
2. `add_layout` — insert it into the page
3. `get_layers` — inspect the structure and layer IDs
4. `move_layer` into `body` if needed + `update_layer_settings` to name it
5. `get_design_context` from Figma — extract texts and asset URLs
6. Update texts, images, and styles using YCode MCP tools
7. Use `list_color_variables` to map colors to project tokens
