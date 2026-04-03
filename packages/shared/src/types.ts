// ─── World Data Types ────────────────────────────────

/** Bundled asset definitions — everything needed to render a world without localStorage. */
export interface WorldAssets {
  /** Custom tile definitions used in this world (beyond built-in TILE_REGISTRY). */
  tiles?: import("./tiles").TileDef[];
  /** Object definitions referenced by world objects. */
  objects?: ObjectDef[];
  /** Animation definitions referenced by objects or tiles. */
  animations?: AnimationDef[];
  /** Character configuration for the player sprite. */
  characterConfig?: CharacterConfig | null;
  /** Tag / category rules. */
  tags?: TagDef[];
  /** Autotile center variant overrides keyed by tileset source. */
  autotileCenterVariants?: Record<string, { col: number; row: number; weight: number }[]>;
  /** Custom linear autotile maps keyed by tileset source. */
  autotileLinearMaps?: Record<string, { col: number; row: number }[]>;
}

export interface WorldData {
  version: number;
  gridWidth: number;
  gridHeight: number;
  spawnX: number;
  spawnY: number;
  /** Multi-layer tile grid: layers[zLayer][y][x] = TileDef.id (0=empty).
   *  z0=water, z1=ground, z2=overlay. */
  layers: number[][][];
  objects: WorldObject[];
  /** Bundled asset definitions for self-contained worlds. */
  assets?: WorldAssets;
  /** Side Page configuration (bio/links panel). */
  sidePageConfig?: SidePageConfig;
}

export interface SidePageLink {
  id: string;
  title: string;
  url: string;
  order: number;
  imageUrl?: string;
}

export type SidePageFont =
  | "system"
  | "serif"
  | "monospace"
  | "pixel"
  | "rounded"
  | "tiny5"
  | "bytesized";

export interface SidePageConfig {
  enabled: boolean;
  headerText?: string;
  headerBold?: boolean;
  headerItalic?: boolean;
  headerAlign?: "left" | "center" | "right";
  links: SidePageLink[];
  backgroundColor?: string;
  textColor?: string;
  linkColor?: string;
  font?: SidePageFont;
  showByDefault?: boolean;
  /** Bundled sidepage themes (snapshotted from editor). */
  themes?: SidePageTheme[];
}

export interface ThemeSpriteRef {
  src: string;
  x: number;
  y: number;
  widthTiles?: number;
  heightTiles?: number;
  scale?: number;
}

export interface NineSliceTiles {
  topLeft?: ThemeSpriteRef;
  top?: ThemeSpriteRef;
  topRight?: ThemeSpriteRef;
  left?: ThemeSpriteRef;
  center?: ThemeSpriteRef;
  right?: ThemeSpriteRef;
  bottomLeft?: ThemeSpriteRef;
  bottom?: ThemeSpriteRef;
  bottomRight?: ThemeSpriteRef;
}

export interface SidePageTheme {
  id: string;
  name: string;
  icon?: ThemeSpriteRef | string;
  isDefault: boolean;
  /** When true, free-tier users can use this theme. */
  freeTierOk?: boolean;
  /** Safe inner padding for content/cards so they stay inside the intended frame area. */
  contentInsetPx?: number;
  /** Extra visual bleed for theme frame art outside panel bounds. */
  visualOverflowPx?: number;
  /** Visual-only overlay scale for the sidepage frame. */
  designScale?: number;
  /** Visual-only horizontal offset for the sidepage frame overlay. */
  designOffsetXPx?: number;
  /** Visual-only vertical offset for the sidepage frame overlay. */
  designOffsetYPx?: number;
  tiles: NineSliceTiles;
  buttons: {
    link: { bg?: NineSliceTiles; icon?: ThemeSpriteRef; inheritMainFrameBg?: boolean; };
    settings: { bg?: NineSliceTiles; icon?: ThemeSpriteRef; inheritMainFrameBg?: boolean; };
    theme?: { bg?: NineSliceTiles; icon?: ThemeSpriteRef; inheritMainFrameBg?: boolean; };
  };
}

export interface WorldObject {
  id: string;
  type: WorldObjectType;
  gridX: number;
  gridY: number;
  label: string;
  payload: ModalPayload | LinkPayload | MediaPayload | CustomObjectPayload;
  cooldownMs: number;
}

export type WorldObjectType = "modal" | "link" | "media" | "custom";

export interface ModalPayload {
  kind: "modal";
  title: string;
  body: string;
}

export interface LinkPayload {
  kind: "link";
  url: string;
  openInNew: boolean;
}

export interface MediaPayload {
  kind: "media";
  src: string;
  alt: string;
  mediaType: "image" | "video";
}

export interface CustomObjectPayload {
  kind: "custom";
  objectDefId: string;
  variationIndex?: number;
  interactable?: boolean;
  onClick?: ObjectClickAction;
  onHover?: ObjectHoverAction;
  billboard?: ObjectBillboardAction;
  billboardClosable?: boolean;
  billboardOpen?: boolean;
  /** Editor-only: show billboard preview on world canvas while editing. */
  billboardPreview?: boolean;
  billboardMediaScale?: number;
  billboardAnchor?: { x: number; y: number };
  /** Editor-only: show hover media preview above object even when not hovering. */
  hoverPreview?: boolean;
  /** Visual scale multiplier for hover media overlays. */
  hoverMediaScale?: number;
  /** Overlay anchor offset (normalized 0-1 within sprite bounds). x=0.5, y=0 = top-center (default). */
  hoverAnchor?: { x: number; y: number };
}

// ─── Object Interaction Types ───────────────────────

export type ObjectClickAction =
  | { type: "none" }
  | { type: "openPageEditor"; pageContent: PageContent };

export type ObjectHoverAction =
  | { type: "none" }
  | { type: "showImage"; imageUrl: string }
  | { type: "showVideo"; videoUrl: string }
  | { type: "showText"; text: string };

export type ObjectBillboardAction =
  | { type: "none" }
  | { type: "showImage"; imageUrl: string }
  | { type: "showVideo"; videoUrl: string }
  | { type: "showText"; text: string };

export type PageWidth = "small" | "medium" | "full";

export interface PageContent {
  /** Tiptap JSON document (ProseMirror JSONContent) */
  tiptapDoc: Record<string, unknown>;
  backgroundColor?: string;
  /** Viewer modal width preset */
  pageWidth?: PageWidth;
}

// ─── User / Profile ─────────────────────────────────

export interface ThemeColors {
  primary: string;
  bg: string;
  accent: string;
}

export interface UserProfile {
  id: string;
  handle: string;
  displayName: string | null;
  image: string | null;
  bio: string | null;
  themeColors: ThemeColors | null;
  tier?: UserTier;
  showBranding?: boolean;
}

// ─── Public World Response ───────────────────────────

export interface PublicWorldResponse {
  publishedData: WorldData;
  profile: UserProfile;
  slug: string;
  worldId: string;
}

// ─── Analytics ───────────────────────────────────────

export type AnalyticsEventType = "page_view" | "interaction";
export type DeviceType = "mobile" | "desktop" | "tablet";

export interface AnalyticsEventInput {
  worldId: string;
  eventType: AnalyticsEventType;
  objectId?: string;
  deviceType: DeviceType;
}

export interface AnalyticsSummary {
  totalViews: number;
  viewsToday: number;
  interactions: { objectId: string; count: number }[];
}

// ─── Category & Credit System ────────────────────────

export interface CategoryDef {
  id: string;
  name: string;
  color: string;
  /** Ordered list of items: "tile:3" or "object:my-tree" */
  items: string[];
  /** Nested subcategories (unlimited depth). */
  children?: CategoryDef[];
}

export type UserTier = "FREE" | "STARTER" | "PRO" | "TESTER";

/** Credit limits per category per tier. */
export interface TierCreditLimits {
  /** category id → max allowed placements */
  [categoryId: string]: number;
}

/** Full credit config: tier → category limits. */
export interface CreditConfig {
  FREE: TierCreditLimits;
  STARTER: TierCreditLimits;
  PRO: TierCreditLimits;
  TESTER: TierCreditLimits;
}

export const CREDIT_CONFIG_KEY = "dev-credit-config";

const DEFAULT_CREDIT_CONFIG: CreditConfig = {
  FREE: {},
  STARTER: {},
  PRO: {},
  TESTER: {},
};

export function loadCreditConfig(): CreditConfig {
  if (typeof window === "undefined") return DEFAULT_CREDIT_CONFIG;
  try {
    const raw = localStorage.getItem(CREDIT_CONFIG_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CreditConfig>) : null;
    if (!parsed) return DEFAULT_CREDIT_CONFIG;
    return {
      FREE: parsed.FREE ?? {},
      STARTER: parsed.STARTER ?? {},
      PRO: parsed.PRO ?? {},
      TESTER: parsed.TESTER ?? {},
    };
  } catch {
    return DEFAULT_CREDIT_CONFIG;
  }
}

// ─── Editor Tool Types ──────────────────────────────

export type EditorTool = "brush" | "eraser" | "spawn" | "object" | "selector";

// ─── Tag / Category System ──────────────────────────

/** LocalStorage key for persisted custom tags. */
export const TAG_STORAGE_KEY = "dev-tag-rules";

/** A tag defines a behavior group for tiles/objects (e.g. "ground", "decoration"). */
export interface TagDef {
  id: string;
  name: string;
  color: string;
  /** Which tag IDs this tag can be placed on. Empty = anywhere.
   *  This serves as the default canPlaceOn for assets with this tag,
   *  but individual assets can override with their own canPlaceOn. */
  canPlaceOn: string[];
}

/** Built-in tag IDs. */
export const TAG_IDS = {
  GROUND:       "ground",
  WATER:        "water",
  DECORATION:   "decoration",
  OBJECT:       "object",
  INTERACTABLE: "interactable",
  BRIDGE:       "bridge",
  PATH:         "path",
  SPAWN:        "spawn",
  ITEM:         "item",
} as const;

export const DEFAULT_TAGS: TagDef[] = [
  { id: TAG_IDS.GROUND,       name: "Ground",       color: "#4a7c59", canPlaceOn: [] },
  { id: TAG_IDS.WATER,        name: "Water",        color: "#3b7cc9", canPlaceOn: [] },
  { id: TAG_IDS.DECORATION,   name: "Decoration",   color: "#c084fc", canPlaceOn: [TAG_IDS.GROUND, TAG_IDS.PATH, TAG_IDS.BRIDGE] },
  { id: TAG_IDS.OBJECT,       name: "Object",       color: "#f59e0b", canPlaceOn: [TAG_IDS.GROUND, TAG_IDS.PATH, TAG_IDS.BRIDGE] },
  { id: TAG_IDS.INTERACTABLE, name: "Interactable", color: "#ef4444", canPlaceOn: [TAG_IDS.GROUND, TAG_IDS.PATH, TAG_IDS.BRIDGE] },
  { id: TAG_IDS.BRIDGE,       name: "Bridge",       color: "#8b5e3c", canPlaceOn: [TAG_IDS.WATER] },
  { id: TAG_IDS.PATH,         name: "Path",         color: "#c4a882", canPlaceOn: [TAG_IDS.GROUND] },
  { id: TAG_IDS.SPAWN,        name: "Spawn",        color: "#ffdd00", canPlaceOn: [TAG_IDS.GROUND, TAG_IDS.BRIDGE, TAG_IDS.PATH] },
  { id: TAG_IDS.ITEM,         name: "Item",         color: "#06b6d4", canPlaceOn: [TAG_IDS.GROUND, TAG_IDS.PATH, TAG_IDS.BRIDGE] },
];

/** Load custom tags from localStorage, falling back to DEFAULT_TAGS. */
export function loadTagsFromStorage(): TagDef[] {
  if (typeof window === "undefined") return DEFAULT_TAGS;
  try {
    const raw = localStorage.getItem(TAG_STORAGE_KEY);
    return raw ? JSON.parse(raw) as TagDef[] : DEFAULT_TAGS;
  } catch {
    return DEFAULT_TAGS;
  }
}

// ─── Collision Shapes ───────────────────────────────

export type CollisionShapeType = "rectangle" | "ellipse";

export interface CollisionShape {
  type: CollisionShapeType;
  /** Offset X from top-left of tile (0-1 normalized, 0=left, 1=right). */
  x: number;
  /** Offset Y from top-left of tile (0-1 normalized, 0=top, 1=bottom). */
  y: number;
  /** Width (0-1 normalized). */
  w: number;
  /** Height (0-1 normalized). */
  h: number;
}

export const DEFAULT_COLLISION: CollisionShape = {
  type: "rectangle",
  x: 0,
  y: 0,
  w: 1,
  h: 1,
};

// ─── Animation Definitions ──────────────────────────

export interface AnimationFrame {
  srcX: number;
  srcY: number;
  widthTiles?: number;
  heightTiles?: number;
  durationMs: number;
  /** Flip sprite horizontally. */
  horizontalFlip?: boolean;
}

export interface AnimationDef {
  id: string;
  name: string;
  /** Tileset image source. */
  tilesetSrc: string;
  frames: AnimationFrame[];
  loop: boolean;
}

// ─── Object Variations ──────────────────────────────

export interface ObjectVariation {
  label: string;
  srcX: number;
  srcY: number;
  /** Optional size override for this variation in tiles. Falls back to ObjectDef size. */
  widthTiles?: number;
  /** Optional size override for this variation in tiles. Falls back to ObjectDef size. */
  heightTiles?: number;
  /** Optional collision override for this variation. Undefined = inherit ObjectDef collision enabled state. */
  collisionEnabled?: boolean;
  tilesetSrc?: string;
  zInteraction?: boolean;
  /** Normalized Y position (0-1) of the z-sorting line. 1 = bottom (default). */
  zLine?: number;
  /** Flip sprite horizontally for this variation. */
  horizontalFlip?: boolean;
  /** Optional animation override for this variation. Undefined = inherit ObjectDef animation. */
  animationId?: string | null;
}

// ─── Object Definitions (dev editor) ────────────────

export interface ObjectDef {
  id: string;
  name: string;
  category: string;       // tag ID for category
  tags: string[];          // additional tag IDs (what this object IS)
  canPlaceOn: string[];    // tag IDs where this object can be placed
  tilesetSrc: string;
  srcX: number;
  srcY: number;
  /** Width in tiles (can be > 1 for large objects like trees). */
  widthTiles: number;
  /** Height in tiles. */
  heightTiles: number;
  zLayer: number;
  /** Collision shape (normalized 0-1 within the object bounds). */
  collision: CollisionShape | null;
  /** Whether this object uses Y-based z-index interaction for depth sorting. */
  zInteraction: boolean;
  /** Normalized Y position (0-1) of the z-sorting line within the sprite. 1 = bottom (default). */
  zLine: number;
  /** Linked animation ID (from AnimationDef). Null = static. */
  animationId: string | null;
  /** Collider tiles: offsets from bottom-left anchor where the object blocks placement.
   *  Each entry is {dx, dy} relative to gridX, gridY (bottom-left). */
  colliderTiles: { dx: number; dy: number }[];
  /** Flip sprite horizontally. */
  horizontalFlip?: boolean;
  /** Visual variations — each has its own srcX/srcY (and optionally tilesetSrc). */
  variations?: ObjectVariation[];
  /** Admin-level flag: this object type can be interacted with (click / hover). */
  interactable?: boolean;
  /** When true, free-tier users can use this object. */
  freeTierOk?: boolean;
}

// ─── Character Configuration ────────────────────────

export interface CharacterClip {
  srcX: number;
  srcY: number;
  frameCount: number;
  frameDurationMs: number;
  animationId?: string;
}

export interface CharacterConfig {
  tilesetSrc: string;
  frameWidthTiles: number;
  frameHeightTiles: number;
  collision: { x: number; y: number; w: number; h: number };
  zLine?: number;
  clips: Record<string, CharacterClip>;
}

// ─── Wind Effect Configuration ──────────────────────

export interface WindConfig {
  /** Whether wind effect is enabled. */
  enabled: boolean;
  /** Number of wind lines on screen at once. */
  density: number;
  /** Line thickness in pixels. */
  size: number;
  /** Line length in pixels. */
  length: number;
  /** Fade distance at each end in pixels (gradient to transparent). */
  fade: number;
  /** Line color as hex string (e.g. "#ffffff"). */
  color: string;
  /** Maximum opacity of the line center (0-1). */
  opacity: number;
  /** Wind direction in degrees (0 = right, 90 = down, 180 = left, 270 = up). */
  direction: number;
  /** Speed of wind lines in pixels per second. */
  speed: number;
  /** Curve intensity 0-100 (0 = straight, 100 = max swirl). */
  curve: number;
}

export const DEFAULT_WIND_CONFIG: WindConfig = {
  enabled: true,
  density: 25,
  size: 2,
  length: 80,
  fade: 30,
  color: "#ffffff",
  opacity: 0.25,
  direction: 0,
  speed: 120,
  curve: 40,
};

export const WIND_CONFIG_KEY = "dev-wind-config";

export function loadWindConfig(): WindConfig {
  if (typeof window === "undefined") return DEFAULT_WIND_CONFIG;
  try {
    const raw = localStorage.getItem(WIND_CONFIG_KEY);
    return raw ? { ...DEFAULT_WIND_CONFIG, ...JSON.parse(raw) } : DEFAULT_WIND_CONFIG;
  } catch {
    return DEFAULT_WIND_CONFIG;
  }
}
