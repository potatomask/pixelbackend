"use client";

import React, { useRef, useEffect, useState } from "react";
import { useEditorStore } from "../store";
import { TILESET_TILE_SIZE, TILE_EMPTY, initDevTiles, getPlaceableTiles, getTileDef, loadTagsFromStorage, loadCreditConfig } from "@mypixelpage/shared";
import type { TileDef, ObjectDef, TagDef, CreditConfig, UserTier, CategoryDef } from "@mypixelpage/shared";
import { useTilesetImages } from "../hooks/useTilesetImages";
import { Eraser, Search } from "lucide-react";
import { T } from "./theme";

const CATEGORIES_KEY = "dev-categories";

function loadCategories(): CategoryDef[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CategoryDef[];
  } catch {
    return null;
  }
}

/** Collect all item keys from a category tree (self + all descendants). */
function collectAllItemKeysFromTree(cats: CategoryDef[]): string[] {
  const keys: string[] = [];
  for (const cat of cats) {
    keys.push(...cat.items);
    if (cat.children?.length) keys.push(...collectAllItemKeysFromTree(cat.children));
  }
  return keys;
}

/** Check if an item exists anywhere in a category subtree. */
function itemExistsInTree(itemKey: string, cats: CategoryDef[]): boolean {
  for (const cat of cats) {
    if (cat.items.includes(itemKey)) return true;
    if (cat.children?.length && itemExistsInTree(itemKey, cat.children)) return true;
  }
  return false;
}

/** Find root category that contains an item (directly or via subcategories). */
function findRootCatForItem(itemKey: string, categories: CategoryDef[]): CategoryDef | null {
  for (const cat of categories) {
    if (cat.items.includes(itemKey)) return cat;
    if (cat.children?.length && itemExistsInTree(itemKey, cat.children)) return cat;
  }
  return null;
}

/** Collect all category ids from a category tree. */
function collectCategoryIds(cats: CategoryDef[]): string[] {
  const ids: string[] = [];
  for (const cat of cats) {
    ids.push(cat.id);
    if (cat.children?.length) ids.push(...collectCategoryIds(cat.children));
  }
  return ids;
}

function loadObjectDefs(): ObjectDef[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("dev-objects") ?? "[]") as ObjectDef[];
  } catch {
    return [];
  }
}

const LAYER_GROUPS: { z: number; label: string; color: string }[] = [
  { z: 0, label: "Water", color: "#3b82f6" },
  { z: 1, label: "Ground", color: "#22c55e" },
  { z: 2, label: "Overlay", color: "#f59e0b" },
];

type AssetItem =
  | { kind: "tile"; tile: TileDef }
  | { kind: "object"; obj: ObjectDef };

function TileSprite({ tile, images, size }: { tile: TileDef; images: Record<string, HTMLImageElement>; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    if (tile.tilesetSrc && images[tile.tilesetSrc]) {
      const thumbX = tile.thumbX ?? tile.srcX;
      const thumbY = tile.thumbY ?? tile.srcY;
      ctx.drawImage(images[tile.tilesetSrc]!, thumbX, thumbY, TILESET_TILE_SIZE, TILESET_TILE_SIZE, 0, 0, size, size);
    } else {
      ctx.fillStyle = tile.color;
      ctx.fillRect(0, 0, size, size);
    }
  }, [tile, images, size]);

  return <canvas ref={ref} width={size} height={size} style={{ display: "block", borderRadius: 3, imageRendering: "pixelated" }} />;
}

function ObjectSprite({ obj, images, size }: { obj: ObjectDef; images: Record<string, HTMLImageElement>; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const img = images[obj.tilesetSrc];
    if (!img) return;

    const sw = obj.widthTiles * TILESET_TILE_SIZE;
    const sh = obj.heightTiles * TILESET_TILE_SIZE;
    const aspect = sw / sh;
    let dw = size;
    let dh = size;
    if (aspect > 1) {
      dh = size / aspect;
    } else {
      dw = size * aspect;
    }
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;
    ctx.drawImage(img, obj.srcX, obj.srcY, sw, sh, dx, dy, dw, dh);
  }, [obj, images, size]);

  return <canvas ref={ref} width={size} height={size} style={{ display: "block", borderRadius: 3, imageRendering: "pixelated" }} />;
}

const assetBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  border: `1px solid ${T.border}`,
  borderRadius: 3,
  cursor: "pointer",
  transition: "transform 0.1s, box-shadow 0.1s",
  backgroundColor: T.btnBg,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

function TileButton({ tile, images, active, onClick, locked }: { tile: TileDef; images: Record<string, HTMLImageElement>; active: boolean; onClick: () => void; locked?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={locked ? `${tile.name} (upgrade to use)` : tile.name}
      style={{
        ...assetBtn,
        borderColor: active ? T.blue : T.border,
        boxShadow: active ? `0 0 0 2px ${T.blue}` : "none",
        opacity: locked ? 0.4 : 1,
        position: "relative" as const,
      }}
    >
      <TileSprite tile={tile} images={images} size={32} />
      {locked && <span style={{ position: "absolute", top: -2, right: -2, fontSize: 10, lineHeight: 1 }}>🔒</span>}
    </button>
  );
}

function ObjectButton({ obj, images, active, onClick, locked }: { obj: ObjectDef; images: Record<string, HTMLImageElement>; active: boolean; onClick: () => void; locked?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={locked ? `${obj.name} (upgrade to use)` : obj.name}
      style={{
        ...assetBtn,
        width: 44,
        height: 44,
        borderColor: active ? T.yellow : T.border,
        boxShadow: active ? `0 0 0 2px ${T.yellow}` : "none",
        opacity: locked ? 0.4 : 1,
        position: "relative" as const,
      }}
    >
      <ObjectSprite obj={obj} images={images} size={36} />
      {locked && <span style={{ position: "absolute", top: -2, right: -2, fontSize: 10, lineHeight: 1 }}>🔒</span>}
    </button>
  );
}



/** Render a mixed list of tiles and objects */
function AssetGrid({
  items,
  images,
  tileActive,
  objectActive,
  onTileClick,
  onObjectClick,
  isFree,
}: {
  items: AssetItem[];
  images: Record<string, HTMLImageElement>;
  tileActive: (id: number) => boolean;
  objectActive: (id: string) => boolean;
  onTileClick: (id: number) => void;
  onObjectClick: (id: string) => void;
  isFree?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {items.map((item) =>
        item.kind === "tile" ? (
          <TileButton
            key={`t${item.tile.id}`}
            tile={item.tile}
            images={images}
            active={tileActive(item.tile.id)}
            onClick={() => onTileClick(item.tile.id)}
            locked={isFree && item.tile.freeTierOk === false}
          />
        ) : (
          <ObjectButton
            key={`o${item.obj.id}`}
            obj={item.obj}
            images={images}
            active={objectActive(item.obj.id)}
            onClick={() => onObjectClick(item.obj.id)}
            locked={isFree && item.obj.freeTierOk === false}
          />
        ),
      )}
    </div>
  );
}

/** Show details of the currently selected tile or object */
function SelectedAssetInfo({
  tool,
  selectedTileId,
  selectedObjectDefId,
  objectDefs,
  allTags,
  images,
}: {
  tool: string;
  selectedTileId: number;
  selectedObjectDefId: string | null;
  objectDefs: ObjectDef[];
  allTags: TagDef[];
  images: Record<string, HTMLImageElement>;
}) {
  const tagName = (id: string) => allTags.find((t) => t.id === id)?.name ?? id;
  const tagColor = (id: string) => allTags.find((t) => t.id === id)?.color ?? "#888";

  // Show object details when object tool is active
  if ((tool === "object") && selectedObjectDefId) {
    const obj = objectDefs.find((o) => o.id === selectedObjectDefId);
    if (!obj) return null;
    return (
      <div style={{ marginBottom: 12, paddingTop: 6 }}>
        <h4 style={{ margin: "0 0 6px", fontSize: "0.85em", color: T.textLight }}>{obj.name}</h4>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <ObjectSprite obj={obj} images={images} size={40} />
          <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
            <div>{obj.widthTiles}×{obj.heightTiles} tiles · z{obj.zLayer}</div>
            {obj.collision && <div style={{ color: "#ef4444" }}>Collision</div>}
            {obj.zInteraction && <div style={{ color: "#ffdd00" }}>Z-Interaction</div>}
            {obj.variations && obj.variations.length > 0 && (
              <div style={{ color: "#c084fc" }}>{obj.variations.length} variation{obj.variations.length !== 1 ? "s" : ""}</div>
            )}
          </div>
        </div>
        {obj.tags.length > 0 && (
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: T.textDim }}>Tags: </span>
            <span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap" }}>
              {obj.tags.map((id) => (
                <span key={id} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: tagColor(id) + "22", color: tagColor(id), border: `1px solid ${tagColor(id)}44` }}>{tagName(id)}</span>
              ))}
            </span>
          </div>
        )}
        {obj.canPlaceOn.length > 0 ? (
          <div>
            <span style={{ fontSize: 10, color: T.textDim }}>Place on: </span>
            <span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap" }}>
              {obj.canPlaceOn.map((id) => (
                <span key={id} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: tagColor(id) + "22", color: tagColor(id), border: `1px solid ${tagColor(id)}44` }}>{tagName(id)}</span>
              ))}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: T.textDim }}>Place on: <span style={{ color: T.textMuted }}>anywhere</span></div>
        )}
      </div>
    );
  }

  // Show tile details when brush/eraser is active
  if ((tool === "brush" || tool === "eraser") && selectedTileId !== TILE_EMPTY) {
    const tile = getTileDef(selectedTileId);
    if (!tile) return null;
    return (
      <div style={{ marginBottom: 12, paddingTop: 6 }}>
        <h4 style={{ margin: "0 0 6px", fontSize: "0.85em", color: T.textLight }}>{tile.name}</h4>
        <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
          <div>Cost: {tile.tileCost} · z{tile.zLayer}</div>
          <div>{tile.walkable ? "Walkable" : "Not walkable"}</div>
        </div>
        {tile.tags.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <span style={{ fontSize: 10, color: T.textDim }}>Tags: </span>
            <span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap" }}>
              {tile.tags.map((id) => (
                <span key={id} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: tagColor(id) + "22", color: tagColor(id), border: `1px solid ${tagColor(id)}44` }}>{tagName(id)}</span>
              ))}
            </span>
          </div>
        )}
        {tile.canPlaceOn && tile.canPlaceOn.length > 0 && (
          <div style={{ marginTop: 2 }}>
            <span style={{ fontSize: 10, color: T.textDim }}>Place on: </span>
            <span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap" }}>
              {tile.canPlaceOn.map((id) => (
                <span key={id} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: tagColor(id) + "22", color: tagColor(id), border: `1px solid ${tagColor(id)}44` }}>{tagName(id)}</span>
              ))}
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export function TilePalette() {
  const selectedTileId = useEditorStore((s) => s.selectedTileId);
  const setSelectedTileId = useEditorStore((s) => s.setSelectedTileId);
  const selectedObjectType = useEditorStore((s) => s.selectedObjectType);
  const selectedObjectDefId = useEditorStore((s) => s.selectedObjectDefId);
  const setSelectedObjectType = useEditorStore((s) => s.setSelectedObjectType);
  const setSelectedObjectDefId = useEditorStore((s) => s.setSelectedObjectDefId);
  const setTool = useEditorStore((s) => s.setTool);
  const tool = useEditorStore((s) => s.tool);
  const worldData = useEditorStore((s) => s.worldData);
  const userTier = useEditorStore((s) => s.userTier);
  const isFree = userTier === "FREE";
  const images = useTilesetImages();

  const [categories, setCategories] = useState<CategoryDef[] | null>(null);
  const [objectDefs, setObjectDefs] = useState<ObjectDef[]>([]);
  const [placeableTiles, setPlaceableTiles] = useState<TileDef[]>([]);
  const [allTags, setAllTags] = useState<TagDef[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [creditConfig, setCreditConfig] = useState<CreditConfig>({ FREE: {}, STARTER: {}, PRO: {}, TESTER: {} });
  const [upgradePrompt, setUpgradePrompt] = useState<{ kind: "tile" | "object"; name: string } | null>(null);

  const toggleGroup = (key: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  useEffect(() => {
    initDevTiles();
    setPlaceableTiles(getPlaceableTiles());
    const loadedCategories = loadCategories();
    setCategories(loadedCategories);
    setObjectDefs(loadObjectDefs());
    setAllTags(loadTagsFromStorage());
    setCreditConfig(loadCreditConfig());

    // Default all groups to collapsed to save sidebar space.
    const initialCollapsed = new Set<string>(["__uncategorized", "__objects", ...LAYER_GROUPS.map((g) => g.label)]);
    if (loadedCategories) {
      collectCategoryIds(loadedCategories).forEach((id) => initialCollapsed.add(id));
    }
    setCollapsedGroups(initialCollapsed);
  }, []);

  // Compute per-root-category usage counts (items in subcategories count toward root)
  const categoryUsage = React.useMemo(() => {
    if (!categories) return {};
    const usage: Record<string, number> = {};
    for (const layer of worldData.layers) {
      for (const row of layer) {
        for (const cell of row) {
          if (cell === TILE_EMPTY) continue;
          const cat = findRootCatForItem(`tile:${cell}`, categories);
          if (cat) usage[cat.id] = (usage[cat.id] ?? 0) + 1;
        }
      }
    }
    for (const obj of worldData.objects) {
      if (obj.payload.kind === "custom") {
        const cat = findRootCatForItem(`object:${(obj.payload as { objectDefId: string }).objectDefId}`, categories);
        if (cat) usage[cat.id] = (usage[cat.id] ?? 0) + 1;
      }
    }
    return usage;
  }, [worldData, categories]);

  const tileActive = (id: number) => selectedTileId === id && (tool === "brush" || tool === "eraser");
  const objectActive = (id: string) => tool === "object" && selectedObjectType === "custom" && selectedObjectDefId === id;

  const handleTileClick = (id: number) => {
    const tile = placeableTiles.find((t) => t.id === id);
    if (isFree && tile && tile.freeTierOk === false) {
      setUpgradePrompt({ kind: "tile", name: tile.name });
      return;
    }
    setSelectedTileId(id);
    if (tool !== "brush" && tool !== "eraser") setTool("brush");
  };

  const handleObjectClick = (id: string) => {
    const obj = objectDefs.find((o) => o.id === id);
    if (isFree && obj && obj.freeTierOk === false) {
      setUpgradePrompt({ kind: "object", name: obj.name });
      return;
    }
    setSelectedObjectType("custom");
    setSelectedObjectDefId(id);
    if (tool !== "object") setTool("object");
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const searchLower = searchQuery.toLowerCase().trim();

  // Resolve item keys to AssetItems
  const resolveItem = (itemKey: string): AssetItem | null => {
    if (typeof itemKey !== "string") return null;
    if (itemKey.startsWith("tile:")) {
      const id = parseInt(itemKey.split(":")[1] ?? "0", 10);
      const tile = placeableTiles.find((t) => t.id === id);
      return tile ? { kind: "tile", tile } : null;
    }
    if (itemKey.startsWith("object:")) {
      const id = itemKey.split(":")[1] ?? "";
      const obj = objectDefs.find((o) => o.id === id);
      return obj ? { kind: "object", obj } : null;
    }
    return null;
  };

  const matchesSearch = (item: AssetItem): boolean => {
    if (!searchLower) return true;
    if (item.kind === "tile") return item.tile.name.toLowerCase().includes(searchLower);
    return item.obj.name.toLowerCase().includes(searchLower);
  };

  // Search results (filtered from all tiles + objects)
  const searchResults: AssetItem[] = searchLower
    ? [
        ...placeableTiles.filter((t) => t.name.toLowerCase().includes(searchLower)).map((tile): AssetItem => ({ kind: "tile", tile })),
        ...objectDefs.filter((o) => o.name.toLowerCase().includes(searchLower)).map((obj): AssetItem => ({ kind: "object", obj })),
      ]
    : [];

  // Build recursive category group tree
  type CatGroup = { id: string; label: string; color: string; items: AssetItem[]; children: CatGroup[] };

  const buildCatGroups = (cats: CategoryDef[]): CatGroup[] =>
    cats
      .map((cat): CatGroup => {
        const items = cat.items.map(resolveItem).filter((i): i is AssetItem => i !== null);
        const children = cat.children?.length ? buildCatGroups(cat.children) : [];
        return { id: cat.id, label: cat.name, color: cat.color, items, children };
      })
      .filter((g) => g.items.length > 0 || g.children.length > 0);

  const catGroups = categories ? buildCatGroups(categories) : null;

  // Uncategorized: items not anywhere in the category tree
  const allAssignedKeys = categories ? new Set(collectAllItemKeysFromTree(categories)) : new Set<string>();

  const uncategorizedTiles = categories ? placeableTiles.filter((t) => !allAssignedKeys.has(`tile:${t.id}`)) : [];
  const uncategorizedObjects = categories ? objectDefs.filter((obj) => !allAssignedKeys.has(`object:${obj.id}`)) : objectDefs;

  const uncategorizedItems: AssetItem[] = [
    ...uncategorizedTiles.map((tile): AssetItem => ({ kind: "tile", tile })),
    ...uncategorizedObjects.map((obj): AssetItem => ({ kind: "object", obj })),
  ];

  // Recursive category group renderer
  const renderCatGroup = (group: CatGroup, depth: number) => {
    const collapsed = collapsedGroups.has(group.id);
    const limit = creditConfig[userTier]?.[group.id] ?? 0;
    const used = categoryUsage[group.id] ?? 0;
    const hasLimit = limit > 0;
    const atLimit = hasLimit && used >= limit;
    const filteredItems = searchLower ? group.items.filter(matchesSearch) : group.items;
    const hasVisibleChildren = group.children.some((c) =>
      c.items.some(matchesSearch) || c.children.length > 0,
    );
    // When searching, skip groups with no matches
    if (searchLower && filteredItems.length === 0 && !hasVisibleChildren) return null;

    return (
      <div key={group.id} style={{
        marginBottom: depth === 0 ? 12 : 6,
        borderBottom: depth === 0 ? `1px solid ${T.border}` : undefined,
        paddingBottom: collapsed ? 0 : (depth === 0 ? 10 : 4),
        marginLeft: depth > 0 ? 10 : 0,
        borderLeft: depth > 0 ? `2px solid ${group.color}44` : undefined,
        paddingLeft: depth > 0 ? 8 : 0,
      }}>
        <button
          onClick={() => toggleGroup(group.id)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 6px", width: "100%", textAlign: "left",
            display: "flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: group.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: depth === 0 ? "0.85em" : "0.8em", color: T.textDim, flex: 1 }}>{group.label}</span>
          {hasLimit && depth === 0 && (
            <span style={{
              fontSize: 10,
              padding: "1px 5px",
              borderRadius: 4,
              background: atLimit ? "#ef444422" : "#22c55e22",
              color: atLimit ? "#ef4444" : "#22c55e",
              fontWeight: 600,
            }}>
              {used}/{limit}
            </span>
          )}
          <span style={{ fontSize: 10, color: T.textMuted, marginRight: 2 }}>{collapsed ? "▶" : "▼"}</span>
        </button>
        {!collapsed && (
          <>
            {filteredItems.length > 0 && (
              <AssetGrid
                items={filteredItems}
                images={images}
                tileActive={tileActive}
                objectActive={objectActive}
                onTileClick={handleTileClick}
                onObjectClick={handleObjectClick}
                isFree={isFree}
              />
            )}
            {group.children.map((child) => renderCatGroup(child, depth + 1))}
          </>
        )}
      </div>
    );
  };

  return (
    <aside className="custom-scrollbar" style={{
      width: "100%",
      backgroundColor: T.sidebarBg,
      padding: 15,
      boxShadow: "2px 0 5px rgba(0,0,0,0.2)",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      height: "100%",
    }}>
      <h3 style={{ margin: "0 0 10px", fontSize: "1.1em", color: T.textLight, display: "flex", alignItems: "center", gap: 8 }}>
        ASSETS
      </h3>

      {/* Search bar */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={14} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: T.textMuted, pointerEvents: "none" }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tiles & objects…"
          style={{
            width: "100%",
            padding: "6px 8px 6px 28px",
            borderRadius: 6,
            border: `1px solid ${T.border}`,
            backgroundColor: T.inputBg,
            color: T.textLight,
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            style={{
              position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: T.textMuted,
              cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Search results */}
      {searchLower ? (
        <div style={{ marginBottom: 12 }}>
          {searchResults.length === 0 ? (
            <div style={{ color: T.textMuted, fontSize: 12, fontStyle: "italic", padding: "8px 0" }}>
              No results for &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6 }}>{searchResults.length} result{searchResults.length !== 1 ? "s" : ""}</div>
              <AssetGrid
                items={searchResults}
                images={images}
                tileActive={tileActive}
                objectActive={objectActive}
                onTileClick={handleTileClick}
                onObjectClick={handleObjectClick}
                isFree={isFree}
              />
            </>
          )}
        </div>
      ) : catGroups ? (
        <>
          {catGroups.map((group) => renderCatGroup(group, 0))}
          {uncategorizedItems.length > 0 && (() => {
            const collapsed = collapsedGroups.has("__uncategorized");
            return (
              <div style={{ marginBottom: 12, borderBottom: `1px solid ${T.border}`, paddingBottom: collapsed ? 0 : 10 }}>
                <button
                  onClick={() => toggleGroup("__uncategorized")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 8px", width: "100%", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span style={{ fontSize: "0.85em", color: T.textDim, flex: 1 }}>Uncategorized</span>
                  <span style={{ fontSize: 10, color: T.textMuted, marginRight: 2 }}>{collapsed ? "▶" : "▼"}</span>
                </button>
                {!collapsed && (
                  <AssetGrid
                    items={uncategorizedItems}
                    images={images}
                    tileActive={tileActive}
                    objectActive={objectActive}
                    onTileClick={handleTileClick}
                    onObjectClick={handleObjectClick}
                    isFree={isFree}
                  />
                )}
              </div>
            );
          })()}
        </>
      ) : (
        <>
          {/* Fallback: tiles by z-layer + uncategorized objects */}
          {LAYER_GROUPS.map(({ z, label, color }) => {
            const layerTiles = placeableTiles.filter((t) => t.zLayer === z);
            if (layerTiles.length === 0) return null;
            const collapsed = collapsedGroups.has(label);
            return (
              <div key={z} style={{ marginBottom: 12, borderBottom: `1px solid ${T.border}`, paddingBottom: collapsed ? 0 : 10 }}>
                <button
                  onClick={() => toggleGroup(label)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 8px", width: "100%", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: "0.85em", color: T.textDim, flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 10, color: T.textMuted, marginRight: 2 }}>{collapsed ? "▶" : "▼"}</span>
                </button>
                {!collapsed && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {layerTiles.map((tile) => (
                      <TileButton key={tile.id} tile={tile} images={images} active={tileActive(tile.id)} onClick={() => handleTileClick(tile.id)} locked={isFree && tile.freeTierOk === false} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {objectDefs.length > 0 && (() => {
            const collapsed = collapsedGroups.has("__objects");
            return (
              <div style={{ marginBottom: 12, borderBottom: `1px solid ${T.border}`, paddingBottom: collapsed ? 0 : 10 }}>
                <button
                  onClick={() => toggleGroup("__objects")}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 8px", width: "100%", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span style={{ fontSize: "0.85em", color: T.textDim, flex: 1 }}>Objects</span>
                  <span style={{ fontSize: 10, color: T.textMuted, marginRight: 2 }}>{collapsed ? "▶" : "▼"}</span>
                </button>
                {!collapsed && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {objectDefs.map((obj) => (
                      <ObjectButton key={obj.id} obj={obj} images={images} active={objectActive(obj.id)} onClick={() => handleObjectClick(obj.id)} locked={isFree && obj.freeTierOk === false} />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      {/* Eraser shortcut */}
      <div style={{ marginBottom: 12, borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          <button
            onClick={() => { setSelectedTileId(TILE_EMPTY); setTool("eraser"); }}
            title="Eraser"
            style={{
              ...assetBtn,
              borderColor: tool === "eraser" ? T.red : T.border,
              boxShadow: tool === "eraser" ? `0 0 0 2px ${T.red}` : "none",
            }}
          >
            <Eraser size={18} style={{ color: tool === "eraser" ? T.red : T.textMuted }} />
          </button>
        </div>
      </div>

      {/* Selected asset details */}
      <SelectedAssetInfo
        tool={tool}
        selectedTileId={selectedTileId}
        selectedObjectDefId={selectedObjectDefId}
        objectDefs={objectDefs}
        allTags={allTags}
        images={images}
      />

      {upgradePrompt && (
        <div
          onClick={() => setUpgradePrompt(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "radial-gradient(circle at 25% 20%, rgba(200, 217, 129, 0.36), rgba(0,0,0,0.64))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
        >
          <style>{`
            @keyframes flowerFloat {
              0% { transform: translateY(0) rotate(0deg); opacity: 0.35; }
              50% { transform: translateY(-10px) rotate(6deg); opacity: 0.9; }
              100% { transform: translateY(0) rotate(0deg); opacity: 0.35; }
            }
          `}</style>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(460px, calc(100vw - 24px))",
              background: "linear-gradient(160deg, #f9fce9 0%, #f3f8d7 55%, #eef6cc 100%)",
              border: "1px solid #c8d981",
              borderRadius: 18,
              padding: 18,
              color: "#384215",
              boxShadow: "0 18px 50px rgba(15, 23, 42, 0.35)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {["✿", "❀", "✾", "✿", "❀", "✾"].map((flower, idx) => (
              <span
                key={`${flower}-${idx}`}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: `${8 + idx * 16}%`,
                  top: idx % 2 === 0 ? 8 : 24,
                  fontSize: idx % 2 === 0 ? 14 : 12,
                  color: idx % 2 === 0 ? "#9db45a" : "#6f8535",
                  animation: `flowerFloat ${1.8 + idx * 0.2}s ease-in-out infinite`,
                  pointerEvents: "none",
                }}
              >
                {flower}
              </span>
            ))}

            <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8, color: "#4d5f22" }}>Oops, tiny lock moment ✨</div>
            <div style={{ fontSize: 14, color: "#4f5d29", lineHeight: 1.6, marginBottom: 14 }}>
              Oops, sorry to say <strong>"{upgradePrompt.name}"</strong> will unlock on a higher tier.
              Would you like to try a higher tier and place this {upgradePrompt.kind}?
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setUpgradePrompt(null)}
                style={{
                  border: "1px solid rgba(141, 161, 77, 0.45)",
                  background: "rgba(255, 255, 255, 0.45)",
                  backdropFilter: "blur(8px)",
                  color: "#516127",
                  borderRadius: 10,
                  padding: "9px 13px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Maybe later
              </button>
              <button
                onClick={() => {
                  window.location.href = "/dashboard/billing";
                }}
                style={{
                  border: "1px solid #8da14d",
                  background: "#8da14d",
                  color: "#f9fce9",
                  borderRadius: 10,
                  padding: "9px 13px",
                  cursor: "pointer",
                  fontWeight: 700,
                  boxShadow: "0 6px 16px rgba(141, 161, 77, 0.35)",
                }}
              >
                Try higher tier
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
