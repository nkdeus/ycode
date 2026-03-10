# Ycode Templates & Element Reference

## Layout Templates (48 total)

Use these template keys with `getLayoutTemplate(key)` from `lib/templates/blocks.ts`.
Each template generates a full section layer tree with fresh IDs.

### Navigation (2)
| Key | Description |
|-----|-------------|
| `navigation-001` | Horizontal nav with logo, links, CTA button, mobile hamburger |
| `navigation-002` | Horizontal nav variant with different layout |

### Hero (5)
| Key | Description |
|-----|-------------|
| `hero-001` | Centered hero with headline, subtitle, CTA buttons |
| `hero-002` | Split hero with text left, image right |
| `hero-003` | Hero with background image, centered text overlay |
| `hero-004` | Hero with image on top, text below |
| `hero-005` | Hero variant with different visual style |

### Header (4)
| Key | Description |
|-----|-------------|
| `header-001` | Simple page header with title and subtitle |
| `header-002` | Header with breadcrumb-style layout |
| `header-003` | Header with background and centered text |
| `header-004` | Header variant with larger typography |

### Features (12)
| Key | Description |
|-----|-------------|
| `features-001` | 3-column feature cards with icons |
| `features-002` | 2-column feature with image side |
| `features-003` | Feature grid with detailed cards |
| `features-004` | Alternating image/text rows |
| `features-005` | Features with numbered items |
| `features-006` | Compact feature list |
| `features-007` | Large feature cards |
| `features-008` | Feature comparison layout |
| `features-009` | Bento grid features |
| `features-010` | Features with illustrations |
| `features-011` | Features horizontal scroll |
| `features-012` | Features minimal style |

### Blog Posts (6)
| Key | Description |
|-----|-------------|
| `blog-posts-001` | 3-column blog post grid |
| `blog-posts-002` | Blog list with featured post |
| `blog-posts-003` | Blog masonry grid |
| `blog-posts-004` | Blog cards with large images |
| `blog-posts-005` | Minimal blog list |
| `blog-posts-006` | Blog with sidebar |

### Blog Header (4)
| Key | Description |
|-----|-------------|
| `blog-headers-001` | Blog article header with title, author, date |
| `blog-headers-002` | Blog header with hero image |
| `blog-headers-003` | Blog header with category tag |
| `blog-headers-004` | Blog header variant |

### Stats (3)
| Key | Description |
|-----|-------------|
| `stats-001` | Horizontal stats bar with numbers |
| `stats-002` | Stats with icons and descriptions |
| `stats-003` | Large number stats section |

### Pricing (1)
| Key | Description |
|-----|-------------|
| `pricing-001` | Pricing table with plan cards |

### Team (2)
| Key | Description |
|-----|-------------|
| `team-001` | Team grid with photos and bios |
| `team-002` | Team cards variant |

### Testimonials (5)
| Key | Description |
|-----|-------------|
| `testimonials-001` | Single testimonial with quote |
| `testimonials-002` | Testimonial cards grid |
| `testimonials-003` | Testimonial with large avatar |
| `testimonials-004` | Testimonial carousel-style |
| `testimonials-005` | Testimonial wall/masonry |

### FAQ (1)
| Key | Description |
|-----|-------------|
| `faq-001` | FAQ accordion-style section |

### Footer (3)
| Key | Description |
|-----|-------------|
| `footer-001` | Multi-column footer with links |
| `footer-002` | Simple footer with copyright |
| `footer-003` | Footer with newsletter signup |

---

## Element Types

### Structure
| `name` | Description | Default tag |
|---------|-------------|-------------|
| `section` | Full-width section wrapper | `<section>` |
| `div` | Generic container / block | `<div>` |
| `container` | Max-width container wrapper | `<div>` |
| `columns` | Column layout container | `<div>` |
| `rows` | Row layout container | `<div>` |
| `grid` | CSS Grid container | `<div>` |
| `hr` | Separator / horizontal rule | `<hr>` |

### Content
| `name` | Description | Default tag |
|---------|-------------|-------------|
| `text` | Rich text element | `settings.tag` (p, h1-h6, span) |

### Media
| `name` | Description | Default tag |
|---------|-------------|-------------|
| `image` | Image element | `<img>` |
| `icon` | SVG icon | `<div>` (inline SVG) |
| `video` | Video player | `<video>` |
| `audio` | Audio player | `<audio>` |
| `map` | Map embed | `<iframe>` |
| `htmlEmbed` | Custom HTML | `<div>` |
| `lightbox` | Image lightbox | `<div>` |

### Actions
| `name` | Description | Default tag |
|---------|-------------|-------------|
| `button` | Button element | `<button>` |
| `link` | Anchor/link | `<a>` |

### Forms
| `name` | Description | Default tag |
|---------|-------------|-------------|
| `form` | Form container | `<form>` |
| `input` | Text input (also email, password via type) | `<input>` |
| `textarea` | Multi-line text input | `<textarea>` |
| `select` | Dropdown | `<select>` |
| `option` | Select option | `<option>` |
| `radio-group` | Radio button group | `<div>` |
| `radio` | Radio button | `<input>` |
| `checkbox` | Checkbox | `<input>` |
| `label` | Form label | `<label>` |
| `message` | Form feedback message | `<div>` |
| `filter` | Search/filter input | `<input>` |

### Slider
| `name` | Description |
|---------|-------------|
| `slider` | Carousel/slider container |
| `slides` | Slides wrapper |
| `slide` | Individual slide |
| `slideButtonPrev` / `slideButtonNext` | Navigation arrows |
| `slideBullets` / `slideBullet` | Dot pagination |
| `slideFraction` | Fraction indicator (1/5) |

### Other
| `name` | Description |
|---------|-------------|
| `collection` | Collection data repeater |
| `pagination` | Pagination controls |
| `localeSelector` | Language picker |
| `code` | Code block |
| `navigation` | Nav menu |

---

## Layer Structure

Every layer follows this structure:

```json
{
  "id": "lyr-<timestamp36><random36>",
  "name": "<element-type>",
  "customName": "Human-readable name",
  "open": true,
  "classes": "tailwind classes string",
  "design": {
    "layout": { "display": "Flex", "flexDirection": "column", "gap": "24px", "isActive": true },
    "typography": { "fontSize": "16", "fontWeight": "600", "color": "#171717", "isActive": true },
    "spacing": { "paddingTop": "24", "paddingBottom": "24", "isActive": true },
    "sizing": { "width": "100%", "maxWidth": "1280px", "isActive": true },
    "borders": { "borderRadius": "12px", "borderWidth": "1", "borderColor": "#e5e5e5", "isActive": true },
    "backgrounds": { "backgroundColor": "#ffffff", "isActive": true },
    "effects": { "opacity": "1", "boxShadow": "sm", "isActive": true },
    "positioning": { "position": "relative", "zIndex": "10", "isActive": true }
  },
  "settings": { "tag": "h2" },
  "variables": {
    "text": {
      "data": {
        "content": {
          "type": "doc",
          "content": [{ "type": "paragraph", "content": [{ "text": "Hello", "type": "text" }] }]
        }
      },
      "type": "dynamic_rich_text"
    },
    "image": {
      "src": { "data": { "content": "/path/to/image.jpg" }, "type": "dynamic_text" },
      "alt": { "data": { "content": "Alt text" }, "type": "dynamic_text" }
    },
    "icon": {
      "src": { "data": { "content": "<svg>...</svg>" }, "type": "static_text" }
    },
    "link": {
      "url": { "data": { "content": "https://..." }, "type": "dynamic_text" },
      "target": { "data": { "content": "_blank" }, "type": "static_text" }
    }
  },
  "children": [],
  "interactions": [],
  "componentId": "uuid (if this is a component instance)"
}
```

### Important Rules

1. **`design` and `classes` must stay in sync** - The `design` object is the source of truth; `classes` is the Tailwind representation. Always set both.
2. **Each `design` category needs `isActive: true`** to be applied.
3. **Text content** uses TipTap/ProseMirror format: `{ type: "doc", content: [{ type: "paragraph", content: [{ text: "...", type: "text" }] }] }`.
4. **IDs** must use the format `lyr-<timestamp36><random36>` (use `generateId('lyr')`).
5. **Page structure**: `body > section > container/div > children`. The `body` is always the root layer.
6. **Component instances** reference a `componentId` and render the component's layer tree.

### Design to Tailwind Quick Reference

| Design | Tailwind |
|--------|----------|
| `layout.display: 'Flex'` | `flex` |
| `layout.flexDirection: 'column'` | `flex-col` |
| `layout.gap: '24'` | `gap-[24px]` |
| `layout.alignItems: 'center'` | `items-center` |
| `layout.justifyContent: 'between'` | `justify-between` |
| `layout.display: 'Grid'` | `grid` |
| `layout.gridColumns: '3'` | `grid-cols-3` |
| `sizing.width: '100%'` | `w-[100%]` or `w-full` |
| `sizing.maxWidth: '1280px'` | `max-w-[1280px]` |
| `spacing.paddingTop: '100'` | `pt-[100px]` |
| `spacing.padding: '24px'` | `p-[24px]` |
| `typography.fontSize: '32'` | `text-[32px]` |
| `typography.fontWeight: '700'` | `font-[700]` |
| `typography.color: '#000000/60'` | `text-[#000000]/60` |
| `typography.textAlign: 'center'` | `text-center` |
| `backgrounds.backgroundColor: '#fff'` | `bg-[#fff]` |
| `borders.borderRadius: '12px'` | `rounded-[12px]` |
| `borders.borderWidth: '1'` | `border` |
| `effects.boxShadow: 'lg'` | `shadow-lg` |
