import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  WorldData,
  WorldObject,
  WorldAssets,
  ObjectDef,
  AnimationDef,
  CharacterConfig,
  WorldObjectType,
  EditorTool,
  UserTier,
  CategoryDef,
  CreditConfig,
} from "@mypixelpage/shared";
import { MAX_UNDO_STACK, createEmptyWorldData } from "@mypixelpage/shared";
import { TILE_EMPTY, getTileDef, resetTileGlobals, initDevTiles, setCustomAutoTileMap, setCustomLinearMap, setCenterVariants } from "@mypixelpage/shared";
import type { TagDef, BitmaskMapEntry, CenterVariant } from "@mypixelpage/shared";
import { DEFAULT_TAGS, loadCreditConfig } from "@mypixelpage/shared";

function loadTagRules(): TagDef[] {
  if (typeof window === "undefined") return DEFAULT_TAGS;
  try {
    const raw = localStorage.getItem("dev-tag-rules");
    return raw ? JSON.parse(raw) : DEFAULT_TAGS;
  } catch {
    return DEFAULT_TAGS;
  }
}

function loadCategories(): CategoryDef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("dev-categories");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Check if an item exists anywhere in a category tree. */
function itemExistsInTree(itemKey: string, cats: CategoryDef[]): boolean {
  for (const cat of cats) {
    if (cat.items.includes(itemKey)) return true;
    if (cat.children?.length && itemExistsInTree(itemKey, cat.children)) return true;
  }
  return false;
}

/** Find the root-level category that ultimately contains an item (directly or in any subcategory). */
function findRootCategoryForItem(itemKey: string, categories: CategoryDef[]): CategoryDef | null {
  for (const cat of categories) {
    if (cat.items.includes(itemKey)) return cat;
    if (cat.children?.length && itemExistsInTree(itemKey, cat.children)) return cat;
  }
  return null;
}

/** Collect all items from a category and all its descendants. */
function collectAllItems(cat: CategoryDef): string[] {
  const items = [...cat.items];
  if (cat.children) {
    for (const child of cat.children) {
      items.push(...collectAllItems(child));
    }
  }
  return items;
}

/** Count placed items per root category (including subcategory items). */
function countCategoryUsage(worldData: WorldData, categories: CategoryDef[]): Record<string, number> {
  // Build root category → all item keys mapping
  const rootItemSets = new Map<string, Set<string>>();
  for (const cat of categories) {
    rootItemSets.set(cat.id, new Set(collectAllItems(cat)));
  }

  const usage: Record<string, number> = {};
  // Count tiles
  for (const layer of worldData.layers) {
    for (const row of layer) {
      for (const cell of row) {
        if (cell === TILE_EMPTY) continue;
        const itemKey = `tile:${cell}`;
        for (const [catId, items] of rootItemSets) {
          if (items.has(itemKey)) {
            usage[catId] = (usage[catId] ?? 0) + 1;
            break;
          }
        }
      }
    }
  }
  // Count objects
  for (const obj of worldData.objects) {
    if (obj.payload.kind === "custom") {
      const itemKey = `object:${obj.payload.objectDefId}`;
      for (const [catId, items] of rootItemSets) {
        if (items.has(itemKey)) {
          usage[catId] = (usage[catId] ?? 0) + 1;
          break;
        }
      }
    }
  }
  return usage;
}

/** Check whether placing one more item of a given category is within credit limits. */
function canPlaceWithCredits(
  worldData: WorldData,
  itemKey: string,
  userTier: UserTier,
): boolean {
  const categories = loadCategories();
  const creditConfig = loadCreditConfig();
  const cat = findRootCategoryForItem(itemKey, categories);
  if (!cat) return true; // uncategorised items are always allowed
  const limit = creditConfig[userTier]?.[cat.id];
  if (limit === undefined || limit === 0) return true; // 0 = no limit configured → allow
  const usage = countCategoryUsage(worldData, categories);
  return (usage[cat.id] ?? 0) < limit;
}

/** Count all non-empty cells across every layer. */
function countTiles(layers: number[][][]): number {
  let n = 0;
  for (const grid of layers) {
    for (const row of grid) {
      for (const cell of row) {
        if (cell !== TILE_EMPTY) n++;
      }
    }
  }
  return n;
}

export interface EditorState {
  // Tool state
  tool: EditorTool;
  selectedTileId: number;
  selectedObjectType: WorldObjectType;
  selectedObjectDefId: string | null;
  selectedObjectId: string | null;

  // World data
  worldData: WorldData;
  worldId: string | null;

  // User identity (prevents cross-account contamination)
  currentUserId: string | null;

  // Credit system
  userTier: UserTier;

  // Derived
  tileCount: number;

  // Loading state
  isLoading: boolean;

  // History
  undoStack: WorldData[];
  redoStack: WorldData[];

  // Save state
  isDirty: boolean;
  lastSavedAt: Date | null;
  isSaving: boolean;

  // Actions
  setTool: (tool: EditorTool) => void;
  setSelectedTileId: (id: number) => void;
  setSelectedObjectType: (type: WorldObjectType) => void;
  setSelectedObjectDefId: (id: string | null) => void;
  selectObject: (id: string | null) => void;
  setUserTier: (tier: UserTier) => void;

  // World mutations
  paintTile: (x: number, y: number) => void;
  eraseTile: (x: number, y: number) => void;
  setSpawn: (x: number, y: number) => void;
  placeObject: (x: number, y: number) => void;
  updateObject: (id: string, patch: Partial<WorldObject>) => void;
  removeObject: (id: string) => void;
  resizeGrid: (width: number, height: number) => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Data management
  resetForUser: (userId: string) => void;
  loadWorldData: (worldData: WorldData, worldId: string) => void;
  markSaved: () => void;
  setSaving: (saving: boolean) => void;
  saveWorld: () => void;
  saveWorldToServer: () => Promise<void>;
  loadFromServer: () => Promise<boolean>;
}

function cloneWorldData(data: WorldData): WorldData {
  return JSON.parse(JSON.stringify(data)) as WorldData;
}

function createEmptyLayer(width: number, height: number): number[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => TILE_EMPTY));
}

function loadObjectDefs(): ObjectDef[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("dev-objects") ?? "[]") as ObjectDef[];
  } catch {
    return [];
  }
}

function loadAnimationDefs(): AnimationDef[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("dev-animations") ?? "[]") as AnimationDef[];
  } catch {
    return [];
  }
}

function loadCharacterConfig(): CharacterConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("dev-character-config");
    return raw ? JSON.parse(raw) as CharacterConfig : null;
  } catch {
    return null;
  }
}

/** Load sidepage themes from localStorage and inject into sidePageConfig. */
function bundleSidePageThemes(worldData: WorldData): WorldData {
  if (typeof window === "undefined") return worldData;
  try {
    const raw = localStorage.getItem("dev-sidepage-themes");
    const themes = raw ? JSON.parse(raw) : [];
    if (!themes.length && !worldData.sidePageConfig) return worldData;
    return {
      ...worldData,
      sidePageConfig: {
        ...(worldData.sidePageConfig ?? { enabled: true, links: [] }),
        themes: themes.length > 0 ? themes : undefined,
      },
    };
  } catch {
    return worldData;
  }
}

/**
 * Restore bundled assets from world data into localStorage so editor palettes,
 * tile definitions, object defs, etc. are in sync with the loaded world.
 * This is critical when switching users — otherwise the previous user's
 * localStorage entries would contaminate the new session.
 */
function restoreAssetsToLocalStorage(worldData: WorldData): void {
  if (typeof window === "undefined") return;
  const assets = worldData.assets;
  if (!assets) return;

  const mergeById = <T extends { id: string | number }>(
    existing: T[],
    incoming: T[],
  ): T[] => {
    const out = new Map<string | number, T>();
    for (const item of incoming) out.set(item.id, item);
    for (const item of existing) out.set(item.id, item);
    return Array.from(out.values());
  };

  const readArray = <T>(key: string): T[] => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  };

  const readRecord = <T extends Record<string, unknown>>(key: string): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed as T;
    } catch {
      return null;
    }
  };

  try {
    if (assets.tiles) {
      const current = readArray<typeof assets.tiles[number]>("dev-tiles");
      const merged = mergeById(current, assets.tiles);
      localStorage.setItem("dev-tiles", JSON.stringify(merged));
    }
    if (assets.objects) {
      const current = readArray<typeof assets.objects[number]>("dev-objects");
      const merged = mergeById(current, assets.objects);
      localStorage.setItem("dev-objects", JSON.stringify(merged));
    }
    if (assets.animations) {
      const current = readArray<typeof assets.animations[number]>("dev-animations");
      const merged = mergeById(current, assets.animations);
      localStorage.setItem("dev-animations", JSON.stringify(merged));
    }
    if (assets.characterConfig) {
      if (!localStorage.getItem("dev-character-config")) {
        localStorage.setItem("dev-character-config", JSON.stringify(assets.characterConfig));
      }
    }
    if (assets.tags) {
      if (!localStorage.getItem("dev-tag-rules")) {
        localStorage.setItem("dev-tag-rules", JSON.stringify(assets.tags));
      }
    }
    if (assets.autotileCenterVariants) {
      const current = readRecord<Record<string, unknown>>("autotile-center-variants") ?? {};
      localStorage.setItem(
        "autotile-center-variants",
        JSON.stringify({ ...assets.autotileCenterVariants, ...current }),
      );
    }
    if (assets.autotileLinearMaps) {
      const current = readRecord<Record<string, unknown>>("autotile-linear-maps") ?? {};
      localStorage.setItem(
        "autotile-linear-maps",
        JSON.stringify({ ...assets.autotileLinearMaps, ...current }),
      );
    }
  } catch {
    // localStorage may be full or unavailable — continue anyway
  }

  // Restore sidepage themes from the world's sidePageConfig (they're bundled
  // into worldData during save but not stored in the assets blob).
  try {
    const themes = worldData.sidePageConfig?.themes;
    if (themes && themes.length > 0) {
      localStorage.setItem("dev-sidepage-themes", JSON.stringify(themes));
    }
  } catch { /* ignore */ }

  // Re-initialize in-memory tile globals from the freshly written localStorage.
  // This ensures module-level caches in @mypixelpage/shared reflect the loaded
  // user's data, not stale leftovers from a previous session.
  initDevTiles();
  if (assets.autotileCenterVariants) {
    for (const [src, variants] of Object.entries(assets.autotileCenterVariants)) {
      setCenterVariants(src, variants as CenterVariant[]);
    }
  }
  if (assets.autotileLinearMaps) {
    for (const [src, map] of Object.entries(assets.autotileLinearMaps)) {
      setCustomLinearMap(src, map as BitmaskMapEntry[]);
    }
  }
}

/** Collect all asset definitions referenced by the world into a self-contained bundle. */
function collectWorldAssets(worldData: WorldData): WorldAssets {
  // 1. Collect all tile IDs used in layers
  const usedTileIds = new Set<number>();
  for (const layer of worldData.layers) {
    for (const row of layer) {
      for (const cell of row) {
        if (cell !== TILE_EMPTY) usedTileIds.add(cell);
      }
    }
  }

  // 2. Get custom tile definitions (all of them — cheap and future-proof)
  const allDevTiles: import("@mypixelpage/shared").TileDef[] = (() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem("dev-tiles") ?? "[]");
    } catch { return []; }
  })();

  // 3. Collect ALL object definitions (not just placed ones — unplaced defs must survive)
  const allObjectDefs = loadObjectDefs();

  // 4. Collect animation definitions referenced by tiles or objects
  const allAnimDefs = loadAnimationDefs();
  const usedAnimIds = new Set<string>();
  for (const tile of allDevTiles) {
    if (tile.animationId) usedAnimIds.add(tile.animationId);
  }
  for (const def of allObjectDefs) {
    if (def.animationId) usedAnimIds.add(def.animationId);
  }
  // 5. Character config
  const characterConfig = loadCharacterConfig();
  if (characterConfig?.clips) {
    for (const clip of Object.values(characterConfig.clips)) {
      if (clip?.animationId) usedAnimIds.add(clip.animationId);
    }
  }

  // Recompute with character animation dependencies included
  const finalUsedAnims = allAnimDefs.filter((a) => usedAnimIds.has(a.id));

  // 6. Tags
  const tags = loadTagRules();

  // 7. Autotile center variants
  let autotileCenterVariants: Record<string, { col: number; row: number; weight: number }[]> | undefined;
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("autotile-center-variants") : null;
    if (raw) autotileCenterVariants = JSON.parse(raw);
  } catch { /* ignore */ }

  // 8. Custom linear maps
  let autotileLinearMaps: Record<string, { col: number; row: number }[]> | undefined;
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("autotile-linear-maps") : null;
    if (raw) autotileLinearMaps = JSON.parse(raw);
  } catch { /* ignore */ }

  return {
    tiles: allDevTiles.length > 0 ? allDevTiles : undefined,
    objects: allObjectDefs.length > 0 ? allObjectDefs : undefined,
    animations: allAnimDefs.length > 0 ? allAnimDefs : undefined,
    characterConfig: characterConfig ?? undefined,
    tags: tags.length > 0 ? tags : undefined,
    autotileCenterVariants,
    autotileLinearMaps,
  };
}

function getObjectFootprintCells(def: ObjectDef, anchorX: number, anchorY: number): { x: number; y: number }[] {
  const colliders = def.colliderTiles?.length ? def.colliderTiles : [{ dx: 0, dy: 0 }];
  return colliders.map((cell) => ({ x: anchorX + cell.dx, y: anchorY - cell.dy }));
}

function canPlaceObjectOnFootprint(worldData: WorldData, def: ObjectDef, anchorX: number, anchorY: number): boolean {
  for (const cell of getObjectFootprintCells(def, anchorX, anchorY)) {
    if (cell.x < 0 || cell.y < 0 || cell.x >= worldData.gridWidth || cell.y >= worldData.gridHeight) return false;
    if (!canPlaceWithTags(worldData, def.tags, cell.x, cell.y, def.canPlaceOn)) return false;
  }
  return true;
}

function canModifyTileWithoutBreakingObjects(worldData: WorldData, nextWorldData: WorldData, objectDefs: ObjectDef[], x: number, y: number): boolean {
  for (const obj of worldData.objects) {
    if (obj.type !== "custom" || obj.payload.kind !== "custom") continue;
    const payload = obj.payload as import("@mypixelpage/shared").CustomObjectPayload;
    const def = objectDefs.find((candidate) => candidate.id === payload.objectDefId);
    if (!def) continue;
    const footprint = getObjectFootprintCells(def, obj.gridX, obj.gridY);
    if (!footprint.some((cell) => cell.x === x && cell.y === y)) continue;
    if (!canPlaceObjectOnFootprint(nextWorldData, def, obj.gridX, obj.gridY)) return false;
  }
  return true;
}

/** Find the object whose bounding box covers cell (cx, cy). Objects with higher Y (lower on screen) checked first. */
function findObjectAtCell(objects: import("@mypixelpage/shared").WorldObject[], objectDefs: ObjectDef[], cx: number, cy: number): import("@mypixelpage/shared").WorldObject | null {
  // Sort by Y descending so we pick the "topmost" visually (highest Y = in front)
  const sorted = [...objects].sort((a, b) => b.gridY - a.gridY);
  for (const obj of sorted) {
    if (obj.type === "custom" && obj.payload.kind === "custom") {
      const def = objectDefs.find((d) => d.id === (obj.payload as import("@mypixelpage/shared").CustomObjectPayload).objectDefId);
      if (def) {
        const left = obj.gridX;
        const top = obj.gridY - (def.heightTiles - 1);
        if (cx >= left && cx < left + def.widthTiles && cy >= top && cy <= obj.gridY) return obj;
        continue;
      }
    }
    if (obj.gridX === cx && obj.gridY === cy) return obj;
  }
  return null;
}

/** Check if placing an item with given tags is allowed at cell (x,y) based on tag rules.
 * If assetCanPlaceOn is provided (non-empty), it overrides the tag-level rules. */
function canPlaceWithTags(worldData: WorldData, itemTags: string[], x: number, y: number, assetCanPlaceOn?: string[]): boolean {
  // If asset defines its own canPlaceOn, use that directly
  if (assetCanPlaceOn && assetCanPlaceOn.length > 0) {
    let allowed = false;
    let hasAnyTile = false;
    for (let z = 0; z < worldData.layers.length; z++) {
      const tileId = worldData.layers[z]?.[y]?.[x] ?? TILE_EMPTY;
      if (tileId === TILE_EMPTY) continue;
      hasAnyTile = true;
      const tileDef = getTileDef(tileId);
      if (!tileDef) continue;
      for (const tileTag of tileDef.tags) {
        if (assetCanPlaceOn.includes(tileTag)) { allowed = true; break; }
      }
      if (allowed) break;
    }
    // If cell is completely empty, treat it as "water" (the default background)
    if (!hasAnyTile && assetCanPlaceOn.includes("water")) return true;
    return allowed;
  }
  if (itemTags.length === 0) return true;
  const tagRules = loadTagRules();
  for (const tagId of itemTags) {
    const rule = tagRules.find((t) => t.id === tagId);
    if (!rule || rule.canPlaceOn.length === 0) continue; // no restriction
    // Check if any tile at (x,y) has one of the allowed tags
    let allowed = false;
    let hasAnyTile = false;
    for (let z = 0; z < worldData.layers.length; z++) {
      const tileId = worldData.layers[z]?.[y]?.[x] ?? TILE_EMPTY;
      if (tileId === TILE_EMPTY) continue;
      hasAnyTile = true;
      const tileDef = getTileDef(tileId);
      if (!tileDef) continue;
      for (const tileTag of tileDef.tags) {
        if (rule.canPlaceOn.includes(tileTag)) { allowed = true; break; }
      }
      if (allowed) break;
    }
    // If cell is completely empty, treat it as "water" (the default background)
    if (!hasAnyTile && rule.canPlaceOn.includes("water")) return true;
    if (!allowed) return false;
  }
  return true;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  tool: "brush",
  selectedTileId: 1, // grass
  selectedObjectType: "modal",
  selectedObjectDefId: null,
  selectedObjectId: null,
  worldData: createEmptyWorldData(),
  worldId: null,
  currentUserId: null,
  userTier: "FREE" as UserTier,
  tileCount: 0,
  isLoading: true,
  undoStack: [],
  redoStack: [],
  isDirty: false,
  lastSavedAt: null,
  isSaving: false,

  // Tool actions
  setTool: (tool: EditorTool) => set({ tool }),
  setSelectedTileId: (selectedTileId: number) => set({ selectedTileId }),
  setSelectedObjectType: (selectedObjectType: WorldObjectType) => set({ selectedObjectType }),
  setSelectedObjectDefId: (selectedObjectDefId: string | null) => set({ selectedObjectDefId }),
  selectObject: (selectedObjectId: string | null) => set({ selectedObjectId }),
  setUserTier: (tier: UserTier) => set({ userTier: tier }),

  // Reset store state when the active user changes.
  // Clears stale world data, undo/redo history, and all user-specific
  // localStorage keys so the incoming user starts from a clean slate.
  resetForUser: (userId: string) => {
    const prevInMemory = get().currentUserId;
    // On page reload currentUserId resets to null — check localStorage
    // to avoid nuking a same-user session on every page load.
    const prevStored = localStorage.getItem("editor-active-user-id");
    const isSameUser = prevInMemory === userId || (prevInMemory === null && prevStored === userId);

    if (isSameUser) {
      // Same user — just sync in-memory tracking, no purge needed
      set({ currentUserId: userId });
      return;
    }

    // Different user (or first-ever load) → purge stale localStorage.
    // Only purge if there WAS a previous user; on first-ever load
    // (prevStored === null), skip purge to preserve existing data.
    if (prevStored !== null) {
      const keysToRemove = [
        "dev-world", "world-dev",
        "dev-tiles", "dev-objects", "dev-animations",
        "dev-character-config", "dev-sidepage-themes",
        "dev-tag-rules", "dev-credit-config", "dev-categories",
        "dev-custom-tileset-sources",
        "autotile-center-variants", "autotile-linear-maps",
        "autotile-custom-maps",
        "dev-wind-config",
      ];
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
      // Also remove any world-{id} cache keys from the previous user
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith("world-")) localStorage.removeItem(k);
      }

      // Reset in-memory tile globals so stale data doesn't bleed through
      resetTileGlobals();
    }

    localStorage.setItem("editor-active-user-id", userId);

    set({
      currentUserId: userId,
      worldData: createEmptyWorldData(),
      worldId: null,
      undoStack: [],
      redoStack: [],
      isDirty: false,
      lastSavedAt: null,
      isSaving: false,
      selectedObjectId: null,
      isLoading: true,
    });
  },

  // Paint tile — writes to the correct z-layer based on selected tile's zLayer
  paintTile: (x: number, y: number) => {
    const { worldData, selectedTileId, userTier } = get();
    if (x < 0 || y < 0 || x >= worldData.gridWidth || y >= worldData.gridHeight) return;
    const def = getTileDef(selectedTileId);
    if (!def) return;

    // Free-tier restriction: only tiles marked freeTierOk are allowed
    if (userTier === "FREE" && def.freeTierOk === false) return;

    // Credit-based placement check
    if (!canPlaceWithCredits(worldData, `tile:${selectedTileId}`, userTier)) return;

    // Tag-based placement validation (asset-level canPlaceOn overrides tag-level rules)
    if (def.tags.length > 0 || (def.canPlaceOn && def.canPlaceOn.length > 0)) {
      if (!canPlaceWithTags(worldData, def.tags, x, y, def.canPlaceOn)) return;
    }

    const z = Math.max(0, Math.floor(def.zLayer));
    const existingLayer = worldData.layers[z];
    const current = existingLayer?.[y]?.[x] ?? TILE_EMPTY;
    if (current === selectedTileId) return; // no change

    const objectDefs = loadObjectDefs();
    const previewData = cloneWorldData(worldData);
    // Grow layer stack on demand for custom z-layers (e.g. z3+)
    while (previewData.layers.length <= z) {
      previewData.layers.push(createEmptyLayer(previewData.gridWidth, previewData.gridHeight));
    }
    previewData.layers[z]![y]![x] = selectedTileId;
    if (!canModifyTileWithoutBreakingObjects(worldData, previewData, objectDefs, x, y)) return;

    get().pushHistory();
    const newData = previewData;
    set({ worldData: newData, isDirty: true, tileCount: countTiles(newData.layers) });
  },

  // Erase — first removes any object that occupies cell, then topmost tile
  eraseTile: (x: number, y: number) => {
    const { worldData, selectedObjectId } = get();
    if (x < 0 || y < 0 || x >= worldData.gridWidth || y >= worldData.gridHeight) return;

    // Check if an object occupies this cell (custom objects can span multiple tiles)
    const objectDefs = loadObjectDefs();
    const hitObj = findObjectAtCell(worldData.objects, objectDefs, x, y);
    if (hitObj) {
      get().pushHistory();
      const newData = cloneWorldData(worldData);
      newData.objects = newData.objects.filter((o) => o.id !== hitObj.id);
      set({
        worldData: newData,
        isDirty: true,
        selectedObjectId: selectedObjectId === hitObj.id ? null : selectedObjectId,
      });
      return;
    }

    // Find topmost layer with a non-empty tile
    let targetZ = -1;
    for (let z = worldData.layers.length - 1; z >= 0; z--) {
      const tileId = worldData.layers[z]?.[y]?.[x] ?? TILE_EMPTY;
      if (tileId !== TILE_EMPTY) { targetZ = z; break; }
    }
    if (targetZ === -1) return; // nothing to erase

    const previewData = cloneWorldData(worldData);
    previewData.layers[targetZ]![y]![x] = TILE_EMPTY;
    if (!canModifyTileWithoutBreakingObjects(worldData, previewData, objectDefs, x, y)) return;

    get().pushHistory();
    const newData = previewData;
    set({ worldData: newData, isDirty: true, tileCount: countTiles(newData.layers) });
  },

  // Set spawn point — only on ground/path/bridge
  setSpawn: (x: number, y: number) => {
    const { worldData } = get();
    if (x < 0 || y < 0 || x >= worldData.gridWidth || y >= worldData.gridHeight) return;
    if (worldData.spawnX === x && worldData.spawnY === y) return;

    // Spawn can only be placed on ground, path, or bridge
    if (!canPlaceWithTags(worldData, ["spawn"], x, y)) return;

    get().pushHistory();
    const newData = cloneWorldData(worldData);
    newData.spawnX = x;
    newData.spawnY = y;
    set({ worldData: newData, isDirty: true });
  },

  // Place object — for multi-tile objects, gridX/gridY is the bottom-left anchor
  placeObject: (x: number, y: number) => {
    const { worldData, selectedObjectType, selectedObjectDefId, userTier } = get();
    if (x < 0 || y < 0 || x >= worldData.gridWidth || y >= worldData.gridHeight) return;

    const objectDefs = loadObjectDefs();
    const selectedDef = selectedObjectDefId
      ? objectDefs.find((obj) => obj.id === selectedObjectDefId) ?? null
      : null;

    // Free-tier restriction: only objects marked freeTierOk are allowed
    if (userTier === "FREE" && selectedDef && selectedDef.freeTierOk === false) return;

    // Credit-based placement check for all object types
    if (selectedDef) {
      if (!canPlaceWithCredits(worldData, `object:${selectedDef.id}`, userTier)) return;
    } else if (selectedObjectType !== "custom") {
      // Non-custom built-in objects (modal, link, media) — check by type
      if (!canPlaceWithCredits(worldData, `object:${selectedObjectType}`, userTier)) return;
    }

    if (selectedObjectType === "custom" && !selectedDef) return;

    // For multi-tile objects: x is center-bottom, y is the bottom row
    let anchorX = x;
    const anchorY = y;
    if (selectedDef) {
      anchorX = x - Math.floor((selectedDef.widthTiles - 1) / 2);
      // Validate bounds for top-left corner
      const topY = anchorY - (selectedDef.heightTiles - 1);
      if (anchorX < 0 || topY < 0 || anchorX + selectedDef.widthTiles > worldData.gridWidth || anchorY >= worldData.gridHeight) return;

      if (!canPlaceObjectOnFootprint(worldData, selectedDef, anchorX, anchorY)) return;

      // Check collider tile overlaps with existing objects
      const colliders = selectedDef.colliderTiles?.length ? selectedDef.colliderTiles : [{ dx: 0, dy: 0 }];
      for (const ct of colliders) {
        const checkX = anchorX + ct.dx;
        const checkY = anchorY - ct.dy; // dy=0 is bottom row (anchorY), dy=1 is one row up
        for (const existing of worldData.objects) {
          if (existing.type !== "custom" || existing.payload.kind !== "custom") continue;
          const eDef = objectDefs.find((d) => d.id === (existing.payload as import("@mypixelpage/shared").CustomObjectPayload).objectDefId);
          if (!eDef) continue;
          const eColliders = eDef.colliderTiles?.length ? eDef.colliderTiles : [{ dx: 0, dy: 0 }];
          for (const ec of eColliders) {
            if (existing.gridX + ec.dx === checkX && existing.gridY - ec.dy === checkY) return; // overlap
          }
        }
      }
    }

    get().pushHistory();
    const newData = cloneWorldData(worldData);

    const newObj: WorldObject = {
      id: nanoid(12),
      type: selectedObjectType,
      gridX: anchorX,
      gridY: anchorY,
      label: selectedObjectType === "custom" && selectedDef ? selectedDef.name : `New ${selectedObjectType}`,
      payload:
        selectedObjectType === "custom" && selectedDef
          ? { kind: "custom", objectDefId: selectedDef.id }
          : selectedObjectType === "modal"
          ? { kind: "modal", title: "Title", body: "Content here..." }
          : selectedObjectType === "link"
            ? { kind: "link", url: "https://example.com", openInNew: true }
            : { kind: "media", src: "https://via.placeholder.com/300", alt: "Media", mediaType: "image" },
      cooldownMs: 500,
    };
    newData.objects.push(newObj);
    set({ worldData: newData, isDirty: true, selectedObjectId: newObj.id });
  },

  // Update object
  updateObject: (id: string, patch: Partial<WorldObject>) => {
    const { worldData } = get();
    const idx = worldData.objects.findIndex((o) => o.id === id);
    if (idx === -1) return;

    get().pushHistory();
    const newData = cloneWorldData(worldData);
    newData.objects[idx] = { ...newData.objects[idx]!, ...patch };
    set({ worldData: newData, isDirty: true });
  },

  // Remove object
  removeObject: (id: string) => {
    const { worldData, selectedObjectId } = get();
    get().pushHistory();
    const newData = cloneWorldData(worldData);
    newData.objects = newData.objects.filter((o) => o.id !== id);
    set({
      worldData: newData,
      isDirty: true,
      selectedObjectId: selectedObjectId === id ? null : selectedObjectId,
    });
  },

  // Resize grid (preserves existing tiles within bounds across all layers)
  resizeGrid: (width: number, height: number) => {
    const { worldData } = get();
    if (width < 1 || height < 1 || width > 500 || height > 500) return;
    if (width === worldData.gridWidth && height === worldData.gridHeight) return;

    get().pushHistory();
    const newData = cloneWorldData(worldData);
    const newLayers: number[][][] = worldData.layers.map((layer) =>
      Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => {
          return layer[y]?.[x] ?? TILE_EMPTY;
        })
      )
    );
    newData.layers = newLayers;
    newData.gridWidth = width;
    newData.gridHeight = height;
    // Clamp spawn if out of bounds
    newData.spawnX = Math.min(newData.spawnX, width - 1);
    newData.spawnY = Math.min(newData.spawnY, height - 1);
    // Remove objects that fell outside
    newData.objects = newData.objects.filter(
      (o) => o.gridX < width && o.gridY < height
    );
    set({ worldData: newData, isDirty: true, tileCount: countTiles(newLayers) });
  },

  // History management
  pushHistory: () => {
    const { worldData, undoStack } = get();
    const newStack = [...undoStack, cloneWorldData(worldData)];
    if (newStack.length > MAX_UNDO_STACK) newStack.shift();
    set({ undoStack: newStack, redoStack: [] });
  },

  undo: () => {
    const { undoStack, worldData } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1]!;
    set({
      worldData: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, cloneWorldData(worldData)],
      isDirty: true,
      tileCount: countTiles(prev.layers),
    });
  },

  redo: () => {
    const { redoStack, worldData } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1]!;
    set({
      worldData: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, cloneWorldData(worldData)],
      isDirty: true,
      tileCount: countTiles(next.layers),
    });
  },

  // Data management
  loadWorldData: (worldData: WorldData, worldId: string) =>
    set({
      worldData: cloneWorldData(worldData),
      worldId,
      undoStack: [],
      redoStack: [],
      isDirty: false,
      tileCount: countTiles(worldData.layers),
    }),

  markSaved: () => set({ isDirty: false, lastSavedAt: new Date(), isSaving: false }),
  setSaving: (isSaving: boolean) => set({ isSaving }),

  saveWorld: () => {
    const { worldData, worldId, isDirty, isSaving } = get();
    if (!isDirty || isSaving) return;
    set({ isSaving: true });

    // Bundle assets and themes with world data before saving
    const withThemes = bundleSidePageThemes(worldData);
    const dataWithAssets: WorldData = {
      ...withThemes,
      assets: collectWorldAssets(withThemes),
    };
    const compactCache: WorldData = {
      ...withThemes,
      assets: undefined,
      sidePageConfig: withThemes.sidePageConfig
        ? {
            ...withThemes.sidePageConfig,
            // Theme packs can be large; keep compact local cache focused on core world data.
            themes: undefined,
          }
        : undefined,
    };

    const key = worldId === "dev" ? "dev-world" : worldId ? `world-${worldId}` : "dev-world";

    const pruneStaleWorldCaches = () => {
      // Remove stale world-* cache entries to free quota for the active world.
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || k === key) continue;
        if (k.startsWith("world-")) localStorage.removeItem(k);
      }
    };

    const tryCacheWrite = (payload: WorldData): boolean => {
      try {
        localStorage.setItem(key, JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    };

    try {
      // Save to localStorage as cache; gracefully degrade if storage is full.
      let cacheSaved = tryCacheWrite(dataWithAssets);
      if (!cacheSaved) {
        pruneStaleWorldCaches();
        cacheSaved = tryCacheWrite(dataWithAssets);
      }
      if (!cacheSaved) {
        // Last resort: compact cache (no bundled assets/themes) for offline safety.
        localStorage.removeItem(key);
        cacheSaved = tryCacheWrite(compactCache);
      }
      if (!cacheSaved) {
        console.warn("[editor] Local cache skipped: storage quota exceeded.");
      }

      // Keep in-memory worldData without the heavy assets blob for undo/redo performance
      set({ isDirty: false, lastSavedAt: new Date(), isSaving: false });
    } catch (err) {
      console.error("Save failed:", err);
      set({ isSaving: false });
    }
    // Also persist to server (fire-and-forget)
    get().saveWorldToServer();
  },

  saveWorldToServer: async () => {
    const { worldData } = get();
    // Bundle assets and themes for server persistence
    const withThemes = bundleSidePageThemes(worldData);
    const dataWithAssets: WorldData = {
      ...withThemes,
      assets: collectWorldAssets(withThemes),
    };
    try {
      // Save + auto-publish via /api/worlds/mine
      const res = await fetch("/api/worlds/mine", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldData: dataWithAssets }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Server save failed (${res.status}): ${body || res.statusText}`);
      }
    } catch (err) {
      // Keep dirty=true so failed server sync is visible and can be retried.
      set({ isDirty: true, isSaving: false });
      console.error("Server save failed (local cache updated, server not updated):", err);
    }
  },

  loadFromServer: async () => {
    set({ isLoading: true });
    try {
      // cache: "no-store" bypasses the browser HTTP cache so we always
      // fetch the authenticated user's own world, not a stale cached copy.
      const res = await fetch("/api/worlds/mine", { cache: "no-store" });
      if (!res.ok) return false;
      const json = await res.json();
      const worldData = json.world?.draftData;
      if (worldData && worldData.layers && worldData.gridWidth) {
        // Restore bundled assets into localStorage so editor palettes,
        // runtime tile defs, object definitions, etc. are up to date.
        restoreAssetsToLocalStorage(worldData);

        get().loadWorldData(worldData, json.world.id);
        return true;
      }
    } catch {
      // server unavailable — fall back to localStorage
    } finally {
      set({ isLoading: false });
    }
    return false;
  },
}));
