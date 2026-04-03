/**
 * Tile Registry — single source of truth for all tile types.
 * Godot-style TileSet: each tile has an ID, display properties,
 * gameplay flags, and a reference to its tileset sprite.
 */

/** Z-layer index: controls render order and auto-tile merging.
 *  0=water, 1=ground, 2=overlay are defaults, but any non-negative integer is valid. */
export type TileLayer = number;

export interface TileDef {
  id: number;
  name: string;
  color: string;       // fallback hex color
  tileCost: number;    // editor cost weight (supports decimals, e.g. 0.5)
  walkable: boolean;
  tilesetSrc?: string; // URL path to tileset image (e.g. "/tilesets/grass.png")
  overlaySrc?: string; // optional second-layer tileset drawn on top (e.g. grass detail)
  srcX: number;        // source X in tileset (pixels)
  srcY: number;        // source Y in tileset (pixels)
  thumbX?: number;     // optional thumbnail X in tileset (pixels); falls back to srcX
  thumbY?: number;     // optional thumbnail Y in tileset (pixels); falls back to srcY
  autoTile?: boolean;  // true → use cardinal bitmask to pick sprite variant
  autoTileMode?: "cardinal" | "quadrant" | "linear"; // cardinal=4-bit (paths), quadrant=8-bit (terrain), linear=4-bit no-corners (bridges). Defaults to quadrant.
  zLayer: TileLayer;   // render & merge group: 0=water, 1=ground, 2=overlay
  tags: string[];      // tag IDs — what this tile IS (e.g. ["ground"], ["water"])
  canPlaceOn: string[];// tag IDs — where this tile can be placed (empty = anywhere)
  animationId?: string | null; // linked animation ID from AnimationDef
  freeTierOk?: boolean; // when true, free-tier users can use this tile
}

/** Native pixel size of tiles inside tileset PNGs. */
export const TILESET_TILE_SIZE = 16;

/** Number of z-layers: 0=water, 1=ground, 2=overlay */
export const NUM_TILE_LAYERS = 3;

/** Tile ID 0 is reserved for empty/void — always non-walkable. */
export const TILE_EMPTY = 0;

export const TILE_REGISTRY: readonly TileDef[] = [
  { id: 0, name: "empty",  color: "#1a1a2e", tileCost: 1, walkable: false, srcX: 0,  srcY: 0,  zLayer: 0, tags: [], canPlaceOn: [] },
  { id: 1, name: "grass",  color: "#4a7c59", tileCost: 1, walkable: true,  tilesetSrc: "/tilesets/grass.png", overlaySrc: "/tilesets/grass_overlay.png", srcX: 16, srcY: 16, autoTile: true, autoTileMode: "quadrant", zLayer: 1, tags: ["ground"], canPlaceOn: [] },
  { id: 2, name: "stone",  color: "#808080", tileCost: 1, walkable: true,  tilesetSrc: "/tilesets/stone.png", srcX: 16, srcY: 16, autoTile: true, autoTileMode: "quadrant", zLayer: 1, tags: ["ground"], canPlaceOn: [] },
  { id: 3, name: "path",   color: "#c4a882", tileCost: 1, walkable: true,  tilesetSrc: "/tilesets/paths.png", srcX: 16, srcY: 16, autoTile: true, autoTileMode: "cardinal", zLayer: 2, tags: ["path"], canPlaceOn: ["ground"] },
  { id: 4, name: "water",  color: "#3b7cc9", tileCost: 0, walkable: false, tilesetSrc: "/tilesets/water.png", srcX: 0,  srcY: 0,  zLayer: 0, tags: ["water"], canPlaceOn: [] },
  { id: 5, name: "gravel", color: "#9e9e8e", tileCost: 1, walkable: true,  tilesetSrc: "/tilesets/soil.png",  srcX: 16, srcY: 16, autoTile: true, autoTileMode: "quadrant", zLayer: 1, tags: ["ground"], canPlaceOn: [] },
  { id: 6, name: "bridge", color: "#8B6914", tileCost: 1, walkable: true,  tilesetSrc: "/tilesets/bridge_v2.png", srcX: 16, srcY: 16, autoTile: true, autoTileMode: "linear", zLayer: 2, tags: ["bridge"], canPlaceOn: ["water"] },
];

/** Water tile ID — used as default animated background, not placeable. */
export const WATER_TILE_ID = 4;

/** Water animation: 4 frames across a 64×16 strip, each 16×16. */
export const WATER_FRAMES = 4;
export const WATER_FRAME_MS = 400; // ms per frame

/** Mutable lookup by ID — includes both registry and dev tiles. */
const TILE_BY_ID = new Map(TILE_REGISTRY.map((t) => [t.id, t]));

/** Register dev tiles (from localStorage), merging with the static registry.
 *  Call once on client mount before rendering the editor. */
export function registerDevTiles(tiles: TileDef[]): void {
  for (const t of tiles) {
    TILE_BY_ID.set(t.id, t);
  }
}

const TILES_STORAGE_KEY = "dev-tiles";
let _devTilesLoaded = false;

/** Load dev tiles from localStorage and register them.
 *  Safe to call multiple times — only loads once. */
export function initDevTiles(): void {
  if (_devTilesLoaded || typeof window === "undefined") return;
  _devTilesLoaded = true;
  try {
    const raw = localStorage.getItem(TILES_STORAGE_KEY);
    if (raw) registerDevTiles(JSON.parse(raw));
  } catch { /* ignore */ }
}

export function getTileDef(id: number): TileDef | undefined {
  return TILE_BY_ID.get(id);
}

/** Get all registered tiles (static registry + any registered dev tiles). */
export function getAllTiles(): TileDef[] {
  return Array.from(TILE_BY_ID.values()).sort((a, b) => a.id - b.id);
}

/** Get all placeable tiles (excludes empty and water background), including dev tiles. */
export function getPlaceableTiles(): TileDef[] {
  return getAllTiles().filter((t) => t.id !== TILE_EMPTY && t.id !== WATER_TILE_ID);
}

export function isTileWalkable(id: number): boolean {
  return getTileDef(id)?.walkable ?? false;
}

/** All unique tileset image URLs needed for rendering (includes overlay sources and dev tiles). */
export function getUniqueTilesetSources(): string[] {
  const set = new Set<string>();
  for (const t of TILE_BY_ID.values()) {
    if (t.tilesetSrc) set.add(t.tilesetSrc);
    if (t.overlaySrc) set.add(t.overlaySrc);
  }
  return Array.from(set);
}

/** All placeable tile IDs (excludes empty and water background).
 *  @deprecated Use getPlaceableTiles() for dynamic tile support. */
export const PLACEABLE_TILES = TILE_REGISTRY.filter((t) => t.id !== TILE_EMPTY && t.id !== WATER_TILE_ID);

/* ── 4-bit Cardinal Auto-Tile ───────────────────── */

export type BitmaskMapEntry = { col: number; row: number };

/**
 * Default cardinal bitmask map for terrain tiles (grass/stone/soil).
 * N=1, E=2, S=4, W=8 → 16 combinations mapped to Sprout Lands 4×4 grid.
 */
export const DEFAULT_CARDINAL_MAP: readonly BitmaskMapEntry[] = [
  /* 0  none   */ { col: 3, row: 3 },
  /* 1  N      */ { col: 3, row: 2 },
  /* 2  E      */ { col: 0, row: 3 },
  /* 3  N+E    */ { col: 0, row: 2 },
  /* 4  S      */ { col: 3, row: 0 },
  /* 5  N+S    */ { col: 3, row: 1 },
  /* 6  E+S    */ { col: 0, row: 0 },
  /* 7  N+E+S  */ { col: 0, row: 1 },
  /* 8  W      */ { col: 2, row: 3 },
  /* 9  N+W    */ { col: 2, row: 2 },
  /* 10 E+W    */ { col: 1, row: 3 },
  /* 11 N+E+W  */ { col: 1, row: 2 },
  /* 12 S+W    */ { col: 2, row: 0 },
  /* 13 N+S+W  */ { col: 2, row: 1 },
  /* 14 E+S+W  */ { col: 1, row: 0 },
  /* 15 all    */ { col: 1, row: 1 },
];

/**
 * Default path bitmask map (paths.png 4×4 grid).
 * Layout: (0,0)=S-cap, (0,1)=vertical, (0,2)=N-cap,
 *         (1,1)=SE, (1,2)=NE, (1,3)=E-cap,
 *         (2,1)=SW, (2,2)=NW, (2,3)=horizontal, (3,3)=W-cap
 */
export const DEFAULT_PATH_MAP: readonly BitmaskMapEntry[] = [
  /* 0  none   */ { col: 0, row: 0 },
  /* 1  N      */ { col: 0, row: 2 },
  /* 2  E      */ { col: 1, row: 3 },
  /* 3  N+E    */ { col: 1, row: 2 },
  /* 4  S      */ { col: 0, row: 0 },
  /* 5  N+S    */ { col: 0, row: 1 },
  /* 6  E+S    */ { col: 1, row: 1 },
  /* 7  N+E+S  */ { col: 0, row: 1 },
  /* 8  W      */ { col: 3, row: 3 },
  /* 9  N+W    */ { col: 2, row: 2 },
  /* 10 E+W    */ { col: 2, row: 3 },
  /* 11 N+E+W  */ { col: 2, row: 3 },
  /* 12 S+W    */ { col: 2, row: 1 },
  /* 13 N+S+W  */ { col: 0, row: 1 },
  /* 14 E+S+W  */ { col: 2, row: 3 },
  /* 15 all    */ { col: 2, row: 3 },
];

/* ── Linear Auto-Tile (bridges) ─────────────────── */

/** Linear auto-tile states — bridges have no corners, only straight segments. */
export const LINEAR_STATES = {
  topCap:   0, // top end of vertical bridge (neighbor below only)
  midV:     1, // vertical middle (neighbors above + below)
  botCap:   2, // bottom end of vertical bridge (neighbor above only)
  leftCap:  3, // left end of horizontal bridge (neighbor to the right only)
  midH:     4, // horizontal middle (neighbors left + right)
  rightCap: 5, // right end of horizontal bridge (neighbor to the left only)
  cross:    6, // intersection (neighbors on both axes)
  isolated: 7, // no same-tile neighbors
} as const;

export const LINEAR_STATE_LABELS: readonly string[] = [
  "Top Cap (↓)", "Mid Vertical (↕)", "Bottom Cap (↑)",
  "Left Cap (→)", "Mid Horizontal (↔)", "Right Cap (←)",
  "Cross (✚)", "Isolated",
];

/**
 * Default linear auto-tile map for bridge-type tiles (8 states).
 * Indexed by LINEAR_STATES values. Adjust via the autotile editor.
 */
export const DEFAULT_LINEAR_MAP: readonly BitmaskMapEntry[] = [
  /* 0 topCap   */ { col: 0, row: 0 },
  /* 1 midV     */ { col: 1, row: 0 },
  /* 2 botCap   */ { col: 2, row: 0 },
  /* 3 leftCap  */ { col: 0, row: 1 },
  /* 4 midH     */ { col: 1, row: 1 },
  /* 5 rightCap */ { col: 2, row: 1 },
  /* 6 cross    */ { col: 3, row: 0 },
  /* 7 isolated */ { col: 1, row: 0 },
];

/** Whether a tile uses the linear auto-tile system (bridges). */
export function isLinearAutoTile(tileId: number): boolean {
  const def = getTileDef(tileId);
  if (!def?.autoTile || !def.tilesetSrc) return false;
  return def.autoTileMode === "linear";
}

/**
 * Compute the linear auto-tile state for a bridge tile at (x, y).
 * Checks same-tile neighbors for connectivity, then falls back to
 * ground-layer detection for isolated tiles to infer orientation.
 */
export function computeLinearState(
  layers: number[][][],
  x: number,
  y: number,
  tileId: number,
): number {
  const def = getTileDef(tileId);
  if (!def) return LINEAR_STATES.isolated;
  const z = def.zLayer;

  const match = (nx: number, ny: number): boolean =>
    (layers[z]?.[ny]?.[nx] ?? TILE_EMPTY) === tileId;

  const hasN = match(x, y - 1);
  const hasE = match(x + 1, y);
  const hasS = match(x, y + 1);
  const hasW = match(x - 1, y);

  const vertical = hasN || hasS;
  const horizontal = hasE || hasW;

  // Cross: neighbors on both axes
  if (vertical && horizontal) return LINEAR_STATES.cross;

  // Pure vertical
  if (hasN && hasS) return LINEAR_STATES.midV;
  if (hasS)         return LINEAR_STATES.topCap;
  if (hasN)         return LINEAR_STATES.botCap;

  // Pure horizontal
  if (hasE && hasW) return LINEAR_STATES.midH;
  if (hasE)         return LINEAR_STATES.leftCap;
  if (hasW)         return LINEAR_STATES.rightCap;

  // Isolated — check ground layer (z=1) for land neighbors to infer direction.
  // Bridge connects land across water, so land direction = bridge axis.
  const hasGround = (nx: number, ny: number): boolean =>
    (layers[1]?.[ny]?.[nx] ?? TILE_EMPTY) !== TILE_EMPTY;

  const landN = hasGround(x, y - 1);
  const landS = hasGround(x, y + 1);
  const landE = hasGround(x + 1, y);
  const landW = hasGround(x - 1, y);

  if ((landN || landS) && !(landE || landW)) return LINEAR_STATES.midV;
  if ((landE || landW) && !(landN || landS)) return LINEAR_STATES.midH;

  return LINEAR_STATES.isolated;
}

/** Custom linear auto-tile maps, keyed by tilesetSrc. */
const customLinearMaps: Record<string, BitmaskMapEntry[]> = {};

export function setCustomLinearMap(tilesetSrc: string, map: BitmaskMapEntry[]): void {
  customLinearMaps[tilesetSrc] = map;
}

export function clearCustomLinearMap(tilesetSrc: string): void {
  delete customLinearMaps[tilesetSrc];
}

export function getLinearAutoTileMap(tilesetSrc: string): readonly BitmaskMapEntry[] {
  return customLinearMaps[tilesetSrc] ?? DEFAULT_LINEAR_MAP;
}

/**
 * Get tileset source coordinates for a linear auto-tile (bridge) at (x, y).
 */
export function getLinearAutoTileSrc(
  layers: number[][][],
  x: number,
  y: number,
  tileId: number,
): { srcX: number; srcY: number } {
  const def = getTileDef(tileId);
  const state = computeLinearState(layers, x, y, tileId);
  const map = getLinearAutoTileMap(def?.tilesetSrc ?? "");
  const pos = map[state] ?? { col: 0, row: 0 };
  return {
    srcX: pos.col * TILESET_TILE_SIZE,
    srcY: pos.row * TILESET_TILE_SIZE,
  };
}

/* ── Custom auto-tile map overrides ─────────────── */

const customMaps: Record<string, BitmaskMapEntry[]> = {};

/** Set a custom bitmask map for a specific tileset (persisted in caller). */
export function setCustomAutoTileMap(tilesetSrc: string, map: BitmaskMapEntry[]): void {
  customMaps[tilesetSrc] = map;
}

/** Clear custom map, reverting to default. */
export function clearCustomAutoTileMap(tilesetSrc: string): void {
  delete customMaps[tilesetSrc];
}

/** Get the active bitmask map for a tileset. */
export function getAutoTileMap(tilesetSrc: string): readonly BitmaskMapEntry[] {
  return customMaps[tilesetSrc] ?? getDefaultAutoTileMap(tilesetSrc);
}

/** Get the built-in default map for a tileset (cardinal or quadrant only).
 *  Linear-mode tiles use their own system via getLinearAutoTileMap(). */
export function getDefaultAutoTileMap(tilesetSrc: string): readonly BitmaskMapEntry[] {
  const tiles = getAllTiles();
  const tile = tiles.find((t) => t.tilesetSrc === tilesetSrc && t.autoTile);
  if (tile && (tile.autoTileMode ?? "quadrant") === "cardinal") return DEFAULT_PATH_MAP;
  return DEFAULT_CARDINAL_MAP;
}

/* ── Bitmask computation ───────────────────────────── */

/**
 * Compute 4-bit cardinal bitmask for a tile at (x, y).
 * N=1, E=2, S=4, W=8. A neighbor matches if it has the same tileId
 * on the same z-layer (Godot-style: same terrain type merges).
 */
export function computeCardinalBitmask(
  layers: number[][][],
  x: number,
  y: number,
  tileId: number,
): number {
  const def = getTileDef(tileId);
  if (!def) return 0;
  const z = def.zLayer;

  const match = (nx: number, ny: number): boolean =>
    (layers[z]?.[ny]?.[nx] ?? TILE_EMPTY) === tileId;

  let mask = 0;
  if (match(x, y - 1)) mask |= 1; // N
  if (match(x + 1, y)) mask |= 2; // E
  if (match(x, y + 1)) mask |= 4; // S
  if (match(x - 1, y)) mask |= 8; // W
  return mask;
}

/**
 * Get tileset source coordinates for an auto-tile at (x, y).
 * Uses customMaps override if set, otherwise default map.
 * Used for path tiles (4-bit cardinal bitmask).
 */
export function getAutoTileSrc(
  layers: number[][][],
  x: number,
  y: number,
  tileId: number,
): { srcX: number; srcY: number } {
  const def = getTileDef(tileId);
  const mask = computeCardinalBitmask(layers, x, y, tileId);
  const map = getAutoTileMap(def?.tilesetSrc ?? "");
  const pos = map[mask] ?? { col: 1, row: 1 };
  return {
    srcX: pos.col * TILESET_TILE_SIZE,
    srcY: pos.row * TILESET_TILE_SIZE,
  };
}

/* ── 8-bit Quadrant Auto-Tile (terrain: grass/stone/soil) ── */

/** Whether a tile uses the quadrant-based terrain auto-tile (11×7 tilesets).
 *  Tiles with autoTileMode="cardinal" or "linear" use 4-bit bitmask instead. */
export function isTerrainAutoTile(tileId: number): boolean {
  const def = getTileDef(tileId);
  if (!def?.autoTile || !def.tilesetSrc) return false;
  return (def.autoTileMode ?? "quadrant") === "quadrant";
}

export interface QuadrantSources {
  tl: { srcX: number; srcY: number };
  tr: { srcX: number; srcY: number };
  bl: { srcX: number; srcY: number };
  br: { srcX: number; srcY: number };
}

const HALF = TILESET_TILE_SIZE / 2; // 8px sub-tile

/**
 * Source tile (col, row) for each quadrant's 5 states.
 * Index: [quadrant: TL=0,TR=1,BL=2,BR=3][state: 0-4]
 * States: 0=outer_corner, 1=vert_edge, 2=horiz_edge, 3=fill, 4=inner_corner
 */
const TERRAIN_QUAD_SRC: { col: number; row: number }[][] = [
  // TL quadrant: depends on N, W, NW
  [
    { col: 0, row: 0 }, // 0: outer corner (X1Y1)
    { col: 0, row: 1 }, // 1: vert edge   (X1Y2)
    { col: 1, row: 0 }, // 2: horiz edge  (X2Y1)
    { col: 1, row: 1 }, // 3: center fill (X2Y2)
    { col: 6, row: 2 }, // 4: inner corner(X7Y3)
  ],
  // TR quadrant: depends on N, E, NE
  [
    { col: 2, row: 0 }, // 0: outer corner (X3Y1)
    { col: 2, row: 1 }, // 1: vert edge   (X3Y2)
    { col: 1, row: 0 }, // 2: horiz edge  (X2Y1)
    { col: 1, row: 1 }, // 3: center fill (X2Y2)
    { col: 5, row: 2 }, // 4: inner corner(X6Y3)
  ],
  // BL quadrant: depends on S, W, SW
  [
    { col: 0, row: 2 }, // 0: outer corner (X1Y3)
    { col: 0, row: 1 }, // 1: vert edge   (X1Y2)
    { col: 1, row: 2 }, // 2: horiz edge  (X2Y3)
    { col: 1, row: 1 }, // 3: center fill (X2Y2)
    { col: 6, row: 1 }, // 4: inner corner(X7Y2)
  ],
  // BR quadrant: depends on S, E, SE
  [
    { col: 2, row: 2 }, // 0: outer corner (X3Y3)
    { col: 2, row: 1 }, // 1: vert edge   (X3Y2)
    { col: 1, row: 2 }, // 2: horiz edge  (X2Y3)
    { col: 1, row: 1 }, // 3: center fill (X2Y2)
    { col: 5, row: 1 }, // 4: inner corner(X6Y2)
  ],
];

/** Pixel offset within a 16×16 tile for each quadrant. */
const QUAD_OFF: [number, number][] = [
  [0, 0],          // TL
  [HALF, 0],       // TR
  [0, HALF],       // BL
  [HALF, HALF],    // BR
];

function quadrantState(card1: boolean, card2: boolean, diag: boolean): number {
  if (!card1 && !card2) return 0; // outer corner
  if (card1 && !card2) return 1;  // vertical edge
  if (!card1 && card2) return 2;  // horizontal edge
  if (diag) return 3;             // center fill
  return 4;                       // inner corner
}

/**
 * Get 4 quadrant source rects (8×8 each) for a terrain auto-tile.
 * Checks all 8 neighbors to handle both cardinal edges and inner corners.
 */
export function getTerrainAutoTileQuadrants(
  layers: number[][][],
  x: number,
  y: number,
  tileId: number,
): QuadrantSources {
  const def = getTileDef(tileId);
  if (!def) {
    const d = { srcX: 0, srcY: 0 };
    return { tl: d, tr: d, bl: d, br: d };
  }

  const z = def.zLayer;
  // Cardinal & diagonal: any non-empty tile on the same z-layer counts as filled.
  // This lets grass/stone/soil merge cleanly at boundaries instead of showing
  // transparent edge gaps between different terrain types.
  const filled = (nx: number, ny: number): boolean =>
    (layers[z]?.[ny]?.[nx] ?? TILE_EMPTY) !== TILE_EMPTY;

  const n = filled(x, y - 1);
  const e = filled(x + 1, y);
  const s = filled(x, y + 1);
  const w = filled(x - 1, y);
  const ne = filled(x + 1, y - 1);
  const se = filled(x + 1, y + 1);
  const sw = filled(x - 1, y + 1);
  const nw = filled(x - 1, y - 1);

  const states = [
    quadrantState(n, w, nw), // TL
    quadrantState(n, e, ne), // TR
    quadrantState(s, w, sw), // BL
    quadrantState(s, e, se), // BR
  ];

  const toSrc = (qi: number): { srcX: number; srcY: number } => {
    const src = TERRAIN_QUAD_SRC[qi]![states[qi]!]!;
    const [offX, offY] = QUAD_OFF[qi]!;
    return {
      srcX: src.col * TILESET_TILE_SIZE + offX,
      srcY: src.row * TILESET_TILE_SIZE + offY,
    };
  };

  return { tl: toSrc(0), tr: toSrc(1), bl: toSrc(2), br: toSrc(3) };
}

/* ── Center Tile Variants ───────────────────────── */

export interface CenterVariant {
  col: number;
  row: number;
  weight: number;
}

/** Per-tilesetSrc center variant lists (loaded from localStorage at init). */
const centerVariantMap = new Map<string, CenterVariant[]>();

export function setCenterVariants(tilesetSrc: string, variants: CenterVariant[]): void {
  centerVariantMap.set(tilesetSrc, variants);
}

/**
 * Deterministic pseudo-random using tile position as seed.
 * Returns a value in [0, 100).
 */
function posHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
  h = ((h >> 13) ^ h) * 1274126177;
  h = ((h >> 16) ^ h);
  return ((h & 0x7fffffff) % 100);
}

/**
 * For a fully-surrounded terrain tile (all 4 quadrants = center fill, state 3),
 * check if it should use a center variant instead.
 * Returns {srcX, srcY} of the variant tile, or null if default center should be used.
 */
export function getCenterVariant(
  tilesetSrc: string,
  x: number,
  y: number,
): { srcX: number; srcY: number } | null {
  const variants = centerVariantMap.get(tilesetSrc);
  if (!variants || variants.length === 0) return null;

  const roll = posHash(x, y);
  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.weight;
    if (roll < cumulative) {
      return {
        srcX: v.col * TILESET_TILE_SIZE,
        srcY: v.row * TILESET_TILE_SIZE,
      };
    }
  }
  return null; // default center
}

/**
 * Reset ALL mutable tile-module state so a fresh user's data can be loaded.
 * Must be called when the active user changes to prevent stale assets from
 * one account leaking into another.
 */
export function resetTileGlobals(): void {
  // Allow initDevTiles to re-run
  _devTilesLoaded = false;

  // Restore the TILE_BY_ID map to only contain static registry tiles
  TILE_BY_ID.clear();
  for (const t of TILE_REGISTRY) {
    TILE_BY_ID.set(t.id, t);
  }

  // Clear all custom auto-tile maps
  for (const key of Object.keys(customMaps)) delete customMaps[key];
  for (const key of Object.keys(customLinearMaps)) delete customLinearMaps[key];
  centerVariantMap.clear();
}
