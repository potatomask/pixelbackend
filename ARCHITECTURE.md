# MyPixelPage — V1 Architecture & Implementation Plan

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                        CDN (Vercel Edge)                 │
│   Static assets · Published world JSON · Spritesheet     │
└──────────────┬───────────────────────────┬───────────────┘
               │                           │
    ┌──────────▼──────────┐     ┌──────────▼──────────┐
    │   Visitor Runtime   │     │   Creator Editor     │
    │  (public page)      │     │  (auth-gated SPA)    │
    │  Canvas renderer    │     │  Canvas + React UI   │
    │  Minimal JS bundle  │     │  Lazy-loaded chunk   │
    └──────────┬──────────┘     └──────────┬──────────┘
               │                           │
               │        HTTPS / JSON       │
               ▼                           ▼
    ┌─────────────────────────────────────────────────┐
    │              API Layer (Next.js API Routes)     │
    │  /api/worlds · /api/publish · /api/analytics    │
    │  Auth middleware · Rate limiting · Validation    │
    └──────────────────────┬──────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
    ┌──────────────┐ ┌──────────┐ ┌──────────────┐
    │  PostgreSQL  │ │ R2 / S3  │ │   Analytics  │
    │  (Supabase)  │ │  Blob    │ │  (Lightweight│
    │  Users       │ │  Storage │ │   table or   │
    │  Worlds      │ │  Avatars │ │   Tinybird)  │
    │  Objects     │ │  Media   │ │              │
    └──────────────┘ └──────────┘ └──────────────┘
```

### Key Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Rendering | **PixiJS v8** (WebGL2, tree-shaken) | GPU-batched sprites, built-in culling, AnimatedSprite, particle-ready, future-proof for rich visuals |
| UI overlays | React (portaled over canvas) | Modals, panels, editor UI — React excels here without touching the game loop |
| Monorepo split | `packages/runtime`, `packages/editor`, `packages/shared` | Visitor bundle never ships editor code; shared types/utils stay DRY |
| World data format | JSON blob (compressed) | Single fetch to hydrate the entire world; cacheable at CDN |
| Editor ↔ Runtime | Same PixiJS engine, editor adds tool overlays | No duplication of rendering logic |

### Bundle Strategy

```
Visitor page:
  runtime.js      ~75-85 KB gzipped  (PixiJS v8 tree-shaken + engine + movement + interactions)
  world.json       ~5-15 KB           (tile data + objects, fetched separately)
  atlas.webp       ~50-100 KB         (spritesheet, cached)
  Total: < 250 KB first load target

Editor page (lazy):
  editor.js        ~60-80 KB gzipped  (tool system + React panels)
  Loaded only on /dashboard/editor route
```

---

## 2. Recommended Tech Stack

### Frontend
| Layer | Technology | Why |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | File-based routing, API routes, edge SSR, image optimization, Vercel-native |
| Language | **TypeScript** | Type safety across shared world schema, API, and client |
| Game Canvas | **PixiJS v8** (tree-shaken imports) | GPU-batched WebGL2 rendering, built-in viewport culling, AnimatedSprite, RenderTexture caching, particle-ready — future-proof for rich animated worlds |
| UI Overlays | **React 18** | Modals, editor panels, HUD — rendered in DOM above canvas |
| Styling | **Tailwind CSS** | Utility-first, tree-shakeable, fast iteration |
| State (Editor) | **Zustand** | Lightweight (~1 KB), simpler than Redux for editor tool state + undo/redo |
| Mobile Touch | **Custom pointer handlers** | Unified pointer events (mouse + touch), virtual D-pad component in React |

### Backend
| Layer | Technology | Why |
|---|---|---|
| API | **Next.js Route Handlers** | Co-located with frontend, typed, serverless |
| Auth | **Supabase Auth** (or NextAuth) | Email + OAuth, JWT sessions, row-level security |
| Database | **Supabase (PostgreSQL)** | Managed Postgres, instant APIs, RLS, generous free tier |
| Blob Storage | **Supabase Storage** (or Cloudflare R2) | Avatars, media images; CDN-fronted |
| Analytics | **Custom lightweight table** in Postgres (or **Tinybird** if scale needed) | Simple event inserts, aggregate reads on dashboard |
| Hosting | **Vercel** | Edge caching, automatic CI/CD, preview deploys |

### Dev Tooling
| Tool | Purpose |
|---|---|
| pnpm workspaces | Monorepo package management |
| Vitest | Unit & integration tests |
| Playwright | E2E tests (mobile + desktop viewports) |
| ESLint + Prettier | Code quality |
| Zod | Runtime schema validation (API inputs, world data) |
| Drizzle ORM | Type-safe SQL queries, migrations |

---

## 3. Data Schema (PostgreSQL via Drizzle)

```typescript
// ─── Users ───────────────────────────────────────────
export const users = pgTable("users", {
  id:          uuid("id").primaryKey().defaultRandom(),
  email:       text("email").notNull().unique(),
  handle:      varchar("handle", { length: 32 }).notNull().unique(),
  displayName: varchar("display_name", { length: 64 }),
  avatarUrl:   text("avatar_url"),
  themeColors: jsonb("theme_colors").$type<{ primary: string; bg: string; accent: string }>(),
  bio:         varchar("bio", { length: 280 }),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ─── Worlds ──────────────────────────────────────────
export const worlds = pgTable("worlds", {
  id:            uuid("id").primaryKey().defaultRandom(),
  ownerId:       uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slug:          varchar("slug", { length: 48 }).notNull().unique(),   // URL slug
  width:         integer("width").notNull().default(32),               // grid columns
  height:        integer("height").notNull().default(32),              // grid rows
  tileSize:      integer("tile_size").notNull().default(16),           // px per tile
  draftData:     jsonb("draft_data").$type<WorldData>().notNull(),     // full editor state
  publishedData: jsonb("published_data").$type<WorldData>(),           // snapshot served to visitors
  publishedAt:   timestamp("published_at"),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
  isPublished:   boolean("is_published").notNull().default(false),
});

// ─── WorldData (JSON blob shape) ─────────────────────
interface WorldData {
  version: number;                        // schema version for migrations
  spawnX: number;
  spawnY: number;
  layers: {
    ground: number[][];                   // 2D array of tile IDs (0 = empty)
    walls:  number[][];                   // solid tiles for collision
    decor:  number[][];                   // visual-only overlay
  };
  objects: WorldObject[];
  tilesetRef: string;                     // key to spritesheet asset
}

interface WorldObject {
  id:     string;                         // nanoid
  type:   "modal" | "link" | "media";
  gridX:  number;
  gridY:  number;
  sprite: number;                         // tile ID for visual
  label:  string;                         // tooltip / hover text
  payload: ModalPayload | LinkPayload | MediaPayload;
  cooldownMs: number;                     // interaction debounce (default 500)
}

interface ModalPayload  { title: string; body: string; }          // sanitized HTML or markdown
interface LinkPayload   { url: string; openInNew: boolean; }      // validated URL
interface MediaPayload  { src: string; alt: string; type: "image" | "video"; }

// ─── Publish Records (version history) ───────────────
export const publishRecords = pgTable("publish_records", {
  id:          uuid("id").primaryKey().defaultRandom(),
  worldId:     uuid("world_id").notNull().references(() => worlds.id, { onDelete: "cascade" }),
  version:     integer("version").notNull(),
  data:        jsonb("data").$type<WorldData>().notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});

// ─── Analytics Events ────────────────────────────────
export const analyticsEvents = pgTable("analytics_events", {
  id:        bigserial("id", { mode: "number" }).primaryKey(),
  worldId:   uuid("world_id").notNull().references(() => worlds.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 32 }).notNull(),   // "page_view" | "interaction"
  objectId:  varchar("object_id", { length: 32 }),               // nullable, for interaction events
  deviceType: varchar("device_type", { length: 16 }),            // "mobile" | "desktop" | "tablet"
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  worldIdx: index("analytics_world_idx").on(table.worldId),
  timeIdx:  index("analytics_time_idx").on(table.timestamp),
}));

// ─── Reports (abuse/moderation) ──────────────────────
export const reports = pgTable("reports", {
  id:        uuid("id").primaryKey().defaultRandom(),
  worldId:   uuid("world_id").notNull().references(() => worlds.id),
  reason:    varchar("reason", { length: 500 }).notNull(),
  reporterIp: varchar("reporter_ip", { length: 45 }),            // hashed or anonymized
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolved:  boolean("resolved").notNull().default(false),
});
```

### Key Schema Notes
- **`draftData` / `publishedData`** — Two separate JSONB columns. Draft is autosaved continuously. Publish copies draft → published atomically.
- **Layers as 2D arrays** — `walls[y][x]` holds tile IDs; 0 = empty. Runtime builds a collision bitmap from the walls layer on load.
- **Objects embedded in WorldData** — No separate DB table for objects in V1; they live inside the JSON blob for atomic save/load. If querying objects independently becomes needed, extract to a table later.
- **Publish records** — Immutable snapshots for rollback. Keep last 10 per world.

---

## 4. API Design

All routes under `/api/`. Auth via Supabase JWT in `Authorization: Bearer <token>` header.

### Creator APIs (auth-required)

```
POST   /api/worlds
  Body: { slug, width?, height? }
  → 201 { world }
  Creates a new world with empty draft. One world per user enforced.

GET    /api/worlds/mine
  → 200 { world }
  Returns the creator's world (draft + meta, no published blob).

PUT    /api/worlds/:worldId/draft
  Body: { draftData: WorldData }
  → 200 { updatedAt }
  Autosave endpoint. Validates WorldData shape with Zod.
  Rate-limited: 1 req/2s per user.

POST   /api/worlds/:worldId/publish
  → 200 { publishedAt, version }
  Copies current draftData → publishedData.
  Creates a publish_record row.
  Invalidates CDN cache for the public world JSON.

POST   /api/worlds/:worldId/unpublish
  → 200 { }
  Sets isPublished = false, nulls publishedData.

PUT    /api/users/profile
  Body: { displayName?, avatarUrl?, bio?, themeColors? }
  → 200 { user }

POST   /api/upload
  Body: FormData (file)
  → 200 { url }
  Upload avatar or media image to blob storage.
  Max 2 MB, image types only. Returns CDN URL.

GET    /api/analytics/summary?worldId=xxx
  → 200 { totalViews, viewsToday, interactions: { objectId, count }[] }
```

### Public APIs (no auth)

```
GET    /api/worlds/public/:slug
  → 200 { publishedData, profile: { displayName, avatarUrl, themeColors, bio } }
  Returns the full published world + creator profile.
  Response is CDN-cached (stale-while-revalidate).
  404 if not published.

POST   /api/analytics/event
  Body: { worldId, eventType, objectId?, deviceType }
  → 202
  Fire-and-forget event insert. No auth needed.
  Rate-limited by IP: 10 req/min per world.

POST   /api/reports
  Body: { worldId, reason }
  → 201
  Rate-limited by IP.
```

### API Validation & Security
- All inputs validated with **Zod schemas** at the route handler level.
- `draftData` validated against `WorldDataSchema` — rejects unknown fields, enforces max object count (50), max text lengths.
- URLs in `LinkPayload` validated: must be `https://`, no `javascript:` or data URIs.
- `ModalPayload.body` sanitized with **DOMPurify** (server-side) to strip XSS vectors.
- File uploads scanned for valid image magic bytes, not just extension.
- CORS restricted to own domain.

---

## 5. Runtime Engine Design (Visitor)

### Game Loop (PixiJS Ticker)

```typescript
// PixiJS app.ticker drives the loop — no manual rAF needed
app.ticker.add((ticker) => {
  const dt = ticker.deltaMS / 1000;

  processInput(dt);         // read keyboard/touch state, compute velocity
  updatePlayer(dt);         // move player, check collisions
  updateCamera(dt);         // lerp camera to follow player
  checkInteractions();      // detect nearby objects, show prompts
  // PixiJS auto-renders the scene graph — no manual draw calls
});
```

### PixiJS Scene Graph Structure
```
app.stage
├── worldContainer (positioned by camera)
│   ├── groundLayer      (Container of Sprites — static tiles)
│   ├── wallLayer         (Container of Sprites — solid tiles)
│   ├── decorLayer        (Container of Sprites — decorations)
│   ├── objectsLayer      (Container — interactive objects with highlights)
│   └── playerSprite      (AnimatedSprite — character)
└── uiContainer (fixed position, not affected by camera)
    └── interactionPrompt (Text — "Press E / Tap")
```

### Rendering Optimization
- **RenderTexture caching**: Static tile layers (ground, walls, decor) are rendered once to a `RenderTexture`. Only re-rendered when camera scrolls past a 4-tile buffer zone.
- **Viewport culling**: PixiJS `Culler` automatically skips off-screen sprites. Only tiles within viewport + buffer are added to the scene.
- **GPU batching**: All sprites sharing the same spritesheet texture are drawn in 1-2 draw calls by PixiJS's batch renderer.
- **Object pooling**: Animated tile sprites are pooled — activated when entering viewport, deactivated when leaving.

### Collision System
- On world load, build a `Uint8Array` collision map from `walls` layer: `1` = solid, `0` = passable.
- Player movement: AABB check against grid cells the player would overlap after proposed move.
- Slide along walls (resolve X and Y axes independently for smooth corner sliding).

### Interaction System
- Each frame, check if player overlaps any object's grid cell (or is within 1-tile radius).
- Show floating prompt ("Press E / Tap") when in range.
- On trigger: dispatch to React overlay via a shared event bus or Zustand store.
- Cooldown per object (default 500ms) prevents spam.

### Camera
- `worldContainer.position` set to negative player position with lerp.
- Clamp to world bounds so edges don't show void.
- Camera movement triggers buffer-zone check for static layer re-cache.

### Rendering Pipeline (per frame — handled by PixiJS)
1. PixiJS clears WebGL context
2. Draw cached static RenderTexture (ground + walls + decor = 1 draw call)
3. Draw animated tile sprites (only those in viewport)
4. Draw interactive objects (with highlight filter if in range)
5. Draw player AnimatedSprite
6. Draw fixed UI elements (interaction prompt)
7. (React DOM handles modals/HUD above PixiJS canvas)

### Mobile Controls
- Virtual D-pad: React component overlaying bottom-left of canvas
- Touch interaction button: bottom-right
- Pointer events with `touch-action: none` on canvas to prevent scroll
- D-pad emits same input state as keyboard (up/down/left/right booleans)

---

## 6. Editor Engine Design (Creator)

### Editor Architecture
```
┌─────────────────────┐
│  EditorShell (React) │
│  ┌────────┐ ┌──────┐│
│  │Toolbar │ │Props ││
│  │ Panel  │ │Panel ││
│  ├────────┤ │      ││
│  │        │ │      ││
│  │ Canvas │ │      ││
│  │(shared │ │      ││
│  │engine) │ │      ││
│  │        │ │      ││
│  └────────┘ └──────┘│
│  ┌──────────────────┐│
│  │   Layer / Tile   ││
│  │    Palette       ││
│  └──────────────────┘│
└─────────────────────┘
```

### Editor State (Zustand)
```typescript
interface EditorState {
  tool: "brush" | "eraser" | "object" | "select";
  activeLayer: "ground" | "walls" | "decor";
  selectedTileId: number;
  selectedObjectType: "modal" | "link" | "media" | null;
  worldData: WorldData;
  undoStack: WorldData[];
  redoStack: WorldData[];
  isDirty: boolean;
  lastSavedAt: Date | null;

  // Actions
  paintTile: (x: number, y: number) => void;
  eraseTile: (x: number, y: number) => void;
  placeObject: (x: number, y: number) => void;
  updateObject: (id: string, patch: Partial<WorldObject>) => void;
  removeObject: (id: string) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
}
```

### Autosave
- Debounced `PUT /api/worlds/:id/draft` every 3 seconds when `isDirty` is true.
- Visual indicator: "Saving..." → "Saved ✓" → "Unsaved changes" states.
- On `beforeunload`, warn if unsaved.

### Undo/Redo
- Snapshot-based: push full `WorldData` clone to undo stack on each meaningful action.
- Cap stack at 50 entries.
- For V1 this is simple and reliable; command-pattern optimization can come later if needed.

---

## 7. Project Structure (Monorepo)

```
mypixelpage/
├── apps/
│   └── web/                          # Next.js application
│       ├── app/
│       │   ├── (public)/
│       │   │   └── [slug]/
│       │   │       └── page.tsx       # Visitor public page
│       │   ├── dashboard/
│       │   │   ├── page.tsx           # Creator dashboard
│       │   │   └── editor/
│       │   │       └── page.tsx       # World editor (lazy-loaded)
│       │   ├── api/
│       │   │   ├── worlds/
│       │   │   │   ├── route.ts       # POST create
│       │   │   │   ├── mine/route.ts
│       │   │   │   ├── [worldId]/
│       │   │   │   │   ├── draft/route.ts
│       │   │   │   │   ├── publish/route.ts
│       │   │   │   │   └── unpublish/route.ts
│       │   │   │   └── public/
│       │   │   │       └── [slug]/route.ts
│       │   │   ├── users/
│       │   │   │   └── profile/route.ts
│       │   │   ├── upload/route.ts
│       │   │   ├── analytics/
│       │   │   │   ├── event/route.ts
│       │   │   │   └── summary/route.ts
│       │   │   └── reports/route.ts
│       │   ├── layout.tsx
│       │   └── page.tsx               # Landing / marketing page
│       ├── public/
│       │   └── assets/
│       │       └── tilesets/           # Default spritesheet(s)
│       └── next.config.ts
│
├── packages/
│   ├── runtime/                       # PixiJS engine (visitor + editor shared)
│   │   ├── src/
│   │   │   ├── engine.ts              # PixiJS Application init, ticker loop
│   │   │   ├── renderer.ts            # Tile layer rendering, RenderTexture caching
│   │   │   ├── player.ts              # Movement, AnimatedSprite
│   │   │   ├── camera.ts              # Follow + clamp + buffer zone
│   │   │   ├── collision.ts           # Grid-based AABB
│   │   │   ├── interaction.ts         # Object proximity + trigger
│   │   │   ├── input.ts               # Keyboard + pointer abstraction
│   │   │   ├── loader.ts              # PixiJS Assets loader, spritesheet
│   │   │   └── types.ts               # WorldData, WorldObject, etc.
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── editor/                        # Editor-specific logic
│   │   ├── src/
│   │   │   ├── store.ts               # Zustand editor state
│   │   │   ├── tools.ts               # Brush, eraser, object placement
│   │   │   ├── history.ts             # Undo/redo
│   │   │   ├── autosave.ts            # Debounced save logic
│   │   │   └── components/
│   │   │       ├── EditorShell.tsx
│   │   │       ├── Toolbar.tsx
│   │   │       ├── TilePalette.tsx
│   │   │       ├── ObjectPropsPanel.tsx
│   │   │       ├── LayerPanel.tsx
│   │   │       └── PublishButton.tsx
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                        # Shared types, schemas, utilities
│       ├── src/
│       │   ├── schemas.ts             # Zod schemas for WorldData, API inputs
│       │   ├── types.ts               # TypeScript interfaces
│       │   ├── constants.ts           # Grid limits, max objects, etc.
│       │   └── sanitize.ts            # URL validation, HTML sanitization
│       ├── package.json
│       └── tsconfig.json
│
├── drizzle/                           # DB migrations
│   └── 0001_initial.sql
├── drizzle.config.ts
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── .env.example
```

---

## 8. Milestone Implementation Plan

### Milestone 1 — Core Runtime Prototype (Week 1-2)

**Goal:** Visitor can load a hardcoded world, move a character, collide with walls, and trigger one interaction.

| Task | Details |
|---|---|
| Project scaffolding | pnpm workspace, Next.js app, `packages/runtime`, `packages/shared`, TypeScript configs |
| World data types | Define `WorldData`, `WorldObject` interfaces and Zod schemas in `shared` |
| Spritesheet setup | Create or source a simple 16×16 tileset PNG/WebP; write atlas loader |
| Canvas engine | `engine.ts`: init canvas, start `requestAnimationFrame` loop |
| Tile renderer | `renderer.ts`: draw ground, walls, decor layers using camera offset; cull off-screen tiles |
| Player movement | `player.ts`: 4-direction movement, constant speed, sprite animation (2-frame) |
| Keyboard input | `input.ts`: keydown/keyup tracking for WASD/arrows |
| Collision | `collision.ts`: build `Uint8Array` from walls layer; AABB slide resolution |
| Camera follow | `camera.ts`: lerp to player, clamp to world bounds |
| Interaction (modal) | `interaction.ts`: proximity check → emit event; React modal component reads event and shows content |
| Test page | `/test` route with hardcoded `WorldData` JSON for development |
| Unit tests | Collision logic, interaction radius checks |

**Deliverable:** A page at `/test` where you walk around a 32×32 grid, bump into walls, and tap an object to see a modal.

---

### Milestone 2 — Creator Editor MVP (Week 3-4)

**Goal:** Creator can paint tiles, place objects, configure payloads, and save/load draft.

| Task | Details |
|---|---|
| Supabase setup | Provision project, configure auth (email + GitHub OAuth), create DB tables via Drizzle migrations |
| Auth flow | Sign up / sign in pages, JWT middleware on API routes |
| Creator dashboard | `/dashboard` page showing world status, "Edit" button |
| World creation API | `POST /api/worlds` — creates world with empty grid |
| Editor shell | `EditorShell.tsx`: split layout (canvas + toolbar + side panels) |
| Brush tool | Click/drag to paint tiles on active layer |
| Eraser tool | Click/drag to clear tiles |
| Layer switching | UI to toggle active layer (ground/walls/decor) and layer visibility |
| Tile palette | Grid of available tile sprites from tileset |
| Object placement | Click to place object, opens property panel |
| Object property panel | Edit type, label, payload fields with validation |
| Undo/redo | Snapshot-based history stack on each action |
| Autosave | Debounced `PUT /api/worlds/:id/draft` every 3s; save indicator |
| Draft load | `GET /api/worlds/mine` → hydrate editor state |
| Preview mode | Toggle to switch from editor tools to visitor-style movement in the same canvas |

**Deliverable:** Creator can sign in, paint a world, place a modal/link/media object, and come back later to find their draft intact.

---

### Milestone 3 — Publish + Public URLs + Analytics (Week 5-6)

**Goal:** Creator publishes their world; anyone can visit it via a shareable URL; basic analytics.

| Task | Details |
|---|---|
| Publish API | `POST /api/worlds/:id/publish` — copy draft → published, create publish_record |
| Unpublish API | `POST /api/worlds/:id/unpublish` |
| Public world API | `GET /api/worlds/public/:slug` — return published data + profile, CDN-cached |
| Public visitor page | `/[slug]` — SSR or SSG page that fetches published world and boots runtime |
| Profile metadata | Creator name, avatar, bio, theme colors shown in visitor page header/corner |
| Link interaction | Open validated URL in new tab with `rel="noopener noreferrer"` |
| Media interaction | Image/video modal with lazy-loaded content |
| Analytics event API | `POST /api/analytics/event` — fire-and-forget insert |
| Track page view | On visitor page mount, fire `page_view` event |
| Track interactions | On object trigger, fire `interaction` event with `objectId` |
| Analytics dashboard | Simple stats card on `/dashboard`: total views, today's views, top interacted objects |
| Report API | `POST /api/reports` — abuse reporting from visitor page |
| SEO basics | `<title>`, `<meta description>`, OpenGraph tags from creator profile on public page |

**Deliverable:** Creator hits "Publish", gets a URL like `mypixelpage.com/johndoe`. Visitors land, roam, interact. Creator sees view counts.

---

### Milestone 4 — Mobile + Polish + Launch (Week 7-8)

**Goal:** Fully functional on mobile, performance-tuned, bug-free, ready for real users.

| Task | Details |
|---|---|
| Virtual D-pad | React touch control overlay, bottom-left; emits directional input |
| Touch interact button | Bottom-right action button for triggering nearby objects |
| Tap-to-interact | Direct tap on objects as alternative to button |
| Touch-action CSS | Prevent browser scroll/zoom on canvas element |
| Viewport meta | Proper mobile viewport, prevent pinch zoom |
| Performance audit | Lighthouse on mobile; target LCP < 2s, TTI < 3s |
| Tile culling | Only draw tiles within camera viewport (already planned but verify) |
| Asset optimization | WebP spritesheets, aggressive caching headers, preload hints |
| Loading screen | Minimal spinner/progress while world data + spritesheet load |
| Error boundaries | Graceful fallback if world data fails to load |
| Responsive editor | Editor usable on tablet; hide on phone with "use desktop" message |
| Accessibility | Keyboard-navigable modals, focus trapping, ARIA labels, contrast check |
| Content sanitization | Verify DOMPurify on all modal bodies, URL validation on all links |
| Rate limiting | Implement on publish, draft save, analytics, report endpoints |
| E2E tests | Playwright: creator flow (build + publish) and visitor flow (roam + interact) on mobile viewport |
| QA pass | Manual testing on iOS Safari, Android Chrome, desktop Chrome/Firefox |
| Domain + deploy | Custom domain, Vercel production deployment, environment variables |

**Deliverable:** Production-ready V1. A creator builds and publishes in under 10 minutes. Visitors have a smooth experience on any device.

---

## 9. Performance Checklist

- [ ] Visitor JS bundle < 90 KB gzipped (PixiJS v8 tree-shaken + runtime)
- [ ] Total first-load < 250 KB (JS + world data + spritesheet)
- [ ] Spritesheet in WebP, single file, < 100 KB
- [ ] World JSON < 20 KB (32×32 grid with 50 objects)
- [ ] Only visible tiles rendered per frame (camera culling)
- [ ] No DOM updates during game loop (React only for overlays)
- [ ] `requestAnimationFrame` loop, no `setInterval`
- [ ] PixiJS resolution matched to device pixel ratio (capped at 2×)
- [ ] Static tile layers cached to RenderTexture (re-render only on buffer overflow)
- [ ] Animated sprites pooled and culled outside viewport + 4-tile buffer
- [ ] Lazy-load editor chunk (dynamic import)
- [ ] CDN caching on published world JSON (`s-maxage=3600, stale-while-revalidate`)
- [ ] Preload spritesheet with `<link rel="preload">`
- [ ] `touch-action: none` on canvas to avoid 300ms tap delay

---

## 10. Security Checklist

- [ ] All API inputs validated with Zod; reject unknown fields
- [ ] `WorldData` schema enforces max 50 objects, max text lengths
- [ ] Modal HTML body sanitized with DOMPurify server-side on save
- [ ] Link URLs must be `https://`; block `javascript:`, `data:`, `blob:` schemes
- [ ] File uploads: validate MIME type + magic bytes, max 2 MB
- [ ] CORS limited to own origin
- [ ] Rate limiting on all mutation endpoints
- [ ] Auth middleware on all creator APIs; verify `ownerId` matches JWT
- [ ] Published world API is read-only, no auth bypass
- [ ] External links opened with `rel="noopener noreferrer" target="_blank"`
- [ ] CSP headers: restrict `script-src`, `frame-src`
- [ ] No user-generated `<script>` or event handlers in modal content
- [ ] Analytics IP addresses hashed or not stored
- [ ] `beforeunload` handler for unsaved editor changes (no data loss)
