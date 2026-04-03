"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  TILE_EMPTY,
  WATER_TILE_ID,
  TILESET_TILE_SIZE,
  initDevTiles,
  getPlaceableTiles,
  getTileDef,
} from "@mypixelpage/shared";
import type { ObjectDef, TileDef, CategoryDef } from "@mypixelpage/shared";
import { syncSettingToServer, loadSettingFromServer, autoHealSettings } from "@/lib/utils/dev-settings-sync";
import { useNotify } from "@/components/notifications";

/* ── Constants ─────────────────────────────────────── */

const STORAGE_KEY = "dev-categories";
const OBJ_STORAGE_KEY = "dev-objects";

const DEFAULT_CATEGORIES: CategoryDef[] = [
  { id: "terrain", name: "Terrain", color: "#4a7c59", items: ["tile:1", "tile:2", "tile:5"] },
  { id: "paths", name: "Paths", color: "#c4a882", items: ["tile:3"] },
  { id: "environment", name: "Environment", color: "#3b7cc9", items: ["tile:4"] },
];

/* ── Tree helpers ──────────────────────────────────── */

/** Collect all item keys from a category tree. */
function collectAllItemKeys(cats: CategoryDef[]): string[] {
  const keys: string[] = [];
  for (const cat of cats) {
    keys.push(...cat.items);
    if (cat.children?.length) keys.push(...collectAllItemKeys(cat.children));
  }
  return keys;
}

/** Count total items in a single category (including descendants). */
function countTreeItems(cat: CategoryDef): number {
  let n = cat.items.length;
  if (cat.children) for (const c of cat.children) n += countTreeItems(c);
  return n;
}

/** Update a category anywhere in the tree by id. */
function updateCatInTree(cats: CategoryDef[], catId: string, updater: (c: CategoryDef) => CategoryDef): CategoryDef[] {
  return cats.map((c) => {
    if (c.id === catId) return updater(c);
    if (c.children?.length) return { ...c, children: updateCatInTree(c.children, catId, updater) };
    return c;
  });
}

/** Remove a category anywhere in the tree by id. */
function removeCatFromTree(cats: CategoryDef[], catId: string): CategoryDef[] {
  return cats
    .filter((c) => c.id !== catId)
    .map((c) => (c.children?.length ? { ...c, children: removeCatFromTree(c.children, catId) } : c));
}

/** Remove an item key from all categories in the tree. */
function removeItemFromTree(cats: CategoryDef[], itemKey: string): CategoryDef[] {
  return cats.map((c) => ({
    ...c,
    items: c.items.filter((i) => i !== itemKey),
    children: c.children?.length ? removeItemFromTree(c.children, itemKey) : c.children,
  }));
}

/** Add a child category under a parent (by id). */
function addChildToTree(cats: CategoryDef[], parentId: string, child: CategoryDef): CategoryDef[] {
  return cats.map((c) => {
    if (c.id === parentId) return { ...c, children: [...(c.children ?? []), child] };
    if (c.children?.length) return { ...c, children: addChildToTree(c.children, parentId, child) };
    return c;
  });
}

/** Insert an item into a specific category (by id) at a given index. */
function insertItemInTree(cats: CategoryDef[], catId: string, itemKey: string, idx: number | null): CategoryDef[] {
  return cats.map((c) => {
    if (c.id === catId) {
      const items = [...c.items];
      if (idx !== null && idx >= 0 && idx <= items.length) {
        items.splice(idx, 0, itemKey);
      } else {
        items.push(itemKey);
      }
      return { ...c, items };
    }
    if (c.children?.length) return { ...c, children: insertItemInTree(c.children, catId, itemKey, idx) };
    return c;
  });
}

/** Move a category up/down within its sibling list. */
function moveCatInTree(cats: CategoryDef[], catId: string, direction: -1 | 1): CategoryDef[] {
  const idx = cats.findIndex((c) => c.id === catId);
  if (idx >= 0) {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= cats.length) return cats;
    const next = [...cats];
    [next[idx], next[newIdx]] = [next[newIdx]!, next[idx]!];
    return next;
  }
  return cats.map((c) =>
    c.children?.length ? { ...c, children: moveCatInTree(c.children, catId, direction) } : c,
  );
}

/* ── Persistence ───────────────────────────────────── */

function loadCategories(): CategoryDef[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

function saveCategories(cats: CategoryDef[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
  syncSettingToServer(STORAGE_KEY, JSON.stringify(cats));
}

function loadObjects(): ObjectDef[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(OBJ_STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/* ── Styles ────────────────────────────────────────── */

const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "#111118",
  color: "#e0e0e0",
  padding: "24px 32px",
  fontFamily: "system-ui, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 10,
  padding: 16,
};

const btnStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};

/* ── Tile mini preview ─────────────────────────────── */

function TileMini({ tileId }: { tileId: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tile = getTileDef(tileId);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs || !tile) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    if (tile.tilesetSrc) {
      const img = new Image();
      img.onload = () => {
        const thumbX = tile.thumbX ?? tile.srcX;
        const thumbY = tile.thumbY ?? tile.srcY;
        ctx.drawImage(img, thumbX, thumbY, TILESET_TILE_SIZE, TILESET_TILE_SIZE, 0, 0, 32, 32);
      };
      img.src = tile.tilesetSrc;
    } else {
      ctx.fillStyle = tile.color;
      ctx.fillRect(0, 0, 32, 32);
    }
  }, [tile]);

  return <canvas ref={ref} width={32} height={32} style={{ borderRadius: 4, imageRendering: "pixelated" }} />;
}

function ObjectMini({ obj }: { obj: ObjectDef }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(
        img,
        obj.srcX, obj.srcY,
        obj.widthTiles * TILESET_TILE_SIZE, obj.heightTiles * TILESET_TILE_SIZE,
        0, 0, 32, 32,
      );
    };
    img.src = obj.tilesetSrc;
  }, [obj]);

  return <canvas ref={ref} width={32} height={32} style={{ borderRadius: 4, imageRendering: "pixelated" }} />;
}

/* ── Main page ─────────────────────────────────────── */

export default function CategoryEditorPage() {
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [objects, setObjects] = useState<ObjectDef[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", color: "#06b6d4" });
  const [addSubTo, setAddSubTo] = useState<string | null>(null);
  const [subCat, setSubCat] = useState({ name: "", color: "#06b6d4" });
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverCat, setDragOverCat] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dbSaved, setDbSaved] = useState<"saved" | "saving" | "unsaved">("saved");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [placeable, setPlaceable] = useState<TileDef[]>([]);
  const { confirm } = useNotify();

  useEffect(() => {
    Promise.all([
      loadSettingFromServer("dev-categories"),
      loadSettingFromServer("dev-objects"),
      loadSettingFromServer("dev-tiles"),
    ]).then(([serverCats, serverObjs, serverTiles]) => {
      initDevTiles();
      setPlaceable(getPlaceableTiles());
      setCategories(loadCategories());
      setObjects(loadObjects());
      autoHealSettings([["dev-categories", serverCats], ["dev-objects", serverObjs], ["dev-tiles", serverTiles]]);
    });
  }, []);

  // All assigned item keys (recursively)
  const assignedItems = new Set(collectAllItemKeys(categories));

  // Unassigned tiles/objects
  const unassignedTiles = placeable.filter((t) => !assignedItems.has(`tile:${t.id}`));
  const unassignedObjects = objects.filter((o) => !assignedItems.has(`object:${o.id}`));

  const resolveItemLabel = useCallback((itemKey: string): string => {
    if (itemKey.startsWith("tile:")) {
      const id = parseInt(itemKey.split(":")[1]!, 10);
      return getTileDef(id)?.name ?? `tile#${id}`;
    }
    if (itemKey.startsWith("object:")) {
      const id = itemKey.split(":")[1]!;
      return objects.find((o) => o.id === id)?.name ?? `obj#${id}`;
    }
    return itemKey;
  }, [objects]);

  const update = useCallback((cats: CategoryDef[]) => {
    setCategories(cats);
    saveCategories(cats);
    setDbSaved("unsaved");
  }, []);

  const handleSaveToDB = useCallback(async () => {
    setDbSaved("saving");
    try {
      const cats = JSON.parse(localStorage.getItem("dev-categories") ?? "[]") as CategoryDef[];
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "dev-categories", value: JSON.stringify(cats) }),
      });
      setDbSaved("saved");
    } catch {
      setDbSaved("unsaved");
    }
  }, []);

  const handleCreateCategory = useCallback(() => {
    const name = newCat.name.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    if (collectAllItemKeys(categories).length === 0 || !categories.some((c) => c.id === id)) {
      update([...categories, { id, name, color: newCat.color, items: [] }]);
    }
    setNewCat({ name: "", color: "#06b6d4" });
    setShowNewForm(false);
  }, [newCat, categories, update]);

  const handleCreateSubcategory = useCallback((parentId: string) => {
    const name = subCat.name.trim();
    if (!name) return;
    const id = `${parentId}--${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
    const child: CategoryDef = { id, name, color: subCat.color, items: [] };
    update(addChildToTree(categories, parentId, child));
    setSubCat({ name: "", color: "#06b6d4" });
    setAddSubTo(null);
  }, [subCat, categories, update]);

  const handleDeleteCategory = useCallback((catId: string) => {
    confirm(
      `Delete this category and all its subcategories?`,
      () => update(removeCatFromTree(categories, catId)),
      { title: "Delete Category", confirmText: "Delete", cancelText: "Cancel" },
    );
  }, [categories, update, confirm]);

  const handleRenameCategory = useCallback((catId: string, newName: string) => {
    update(updateCatInTree(categories, catId, (c) => ({ ...c, name: newName })));
  }, [categories, update]);

  const handleMoveCategory = useCallback((catId: string, direction: -1 | 1) => {
    update(moveCatInTree(categories, catId, direction));
  }, [categories, update]);

  const toggleCollapsed = useCallback((catId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  }, []);

  // ─── Drag & drop handlers ───

  const handleDragStart = useCallback((itemKey: string) => {
    setDragItem(itemKey);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, catId: string, idx: number) => {
    e.preventDefault();
    setDragOverCat(catId);
    setDragOverIdx(idx);
  }, []);

  const handleDragOverCategory = useCallback((e: React.DragEvent, catId: string) => {
    e.preventDefault();
    setDragOverCat(catId);
    setDragOverIdx(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetCatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragItem) return;

    // Remove from all categories (recursively)
    let newCats = removeItemFromTree(categories, dragItem);

    // Insert into target category
    newCats = insertItemInTree(newCats, targetCatId, dragItem, dragOverIdx);

    update(newCats);
    setDragItem(null);
    setDragOverCat(null);
    setDragOverIdx(null);
  }, [dragItem, dragOverIdx, categories, update]);

  const handleDragEnd = useCallback(() => {
    setDragItem(null);
    setDragOverCat(null);
    setDragOverIdx(null);
  }, []);

  const handleRemoveItem = useCallback((catId: string, itemKey: string) => {
    update(updateCatInTree(categories, catId, (c) => ({ ...c, items: c.items.filter((i) => i !== itemKey) })));
  }, [categories, update]);

  const handleReset = useCallback(() => {
    confirm(
      "Reset all categories to default? This cannot be undone.",
      () => update([...DEFAULT_CATEGORIES]),
      { title: "Reset Categories", confirmText: "Reset", cancelText: "Cancel" },
    );
  }, [update, confirm]);

  // ─── Item pill renderer ───

  const renderItemPill = (itemKey: string, catId?: string, idx?: number) => {
    const isTile = itemKey.startsWith("tile:");
    const label = resolveItemLabel(itemKey);
    const tileId = isTile ? parseInt(itemKey.split(":")[1]!, 10) : null;
    const obj = !isTile ? objects.find((o) => o.id === itemKey.split(":")[1]) : null;

    return (
      <div
        key={`${catId ?? "unassigned"}-${itemKey}`}
        draggable
        onDragStart={() => handleDragStart(itemKey)}
        onDragEnd={handleDragEnd}
        onDragOver={catId && idx !== undefined ? (e) => handleDragOver(e, catId, idx) : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          background: dragItem === itemKey ? "#2a2a4e" : "#16162a",
          borderRadius: 6,
          border: "1px solid #2a2a3e",
          cursor: "grab",
          opacity: dragItem === itemKey ? 0.5 : 1,
          fontSize: 11,
          userSelect: "none",
        }}
      >
        {tileId !== null && <TileMini tileId={tileId} />}
        {obj && <ObjectMini obj={obj} />}
        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{label}</span>
        <span style={{ color: "#555" }}>{isTile ? "tile" : "obj"}</span>
        {catId && (
          <button
            onClick={(e) => { e.stopPropagation(); handleRemoveItem(catId, itemKey); }}
            style={{
              background: "none", border: "none", color: "#f87171",
              cursor: "pointer", fontSize: 13, padding: "0 2px", marginLeft: "auto",
            }}
          >
            ×
          </button>
        )}
      </div>
    );
  };

  // ─── Recursive category renderer ───

  const renderCategory = (cat: CategoryDef, depth: number, siblingCount: number, siblingIdx: number) => {
    const isCollapsed = collapsed.has(cat.id);
    const childCount = cat.children?.length ?? 0;
    const totalItems = countTreeItems(cat);

    return (
      <div
        key={cat.id}
        onDragOver={(e) => handleDragOverCategory(e, cat.id)}
        onDrop={(e) => handleDrop(e, cat.id)}
        style={{
          ...(depth === 0 ? cardStyle : {}),
          marginLeft: depth > 0 ? 20 : 0,
          background: depth === 0
            ? (dragOverCat === cat.id ? "#1e1e3a" : "#1a1a2e")
            : (dragOverCat === cat.id ? "#1e1e3a" : "#16162a"),
          borderTop: depth > 0 ? `1px solid ${dragOverCat === cat.id ? cat.color : "#2a2a3e"}` : undefined,
          borderRight: depth > 0 ? `1px solid ${dragOverCat === cat.id ? cat.color : "#2a2a3e"}` : undefined,
          borderBottom: depth > 0 ? `1px solid ${dragOverCat === cat.id ? cat.color : "#2a2a3e"}` : undefined,
          borderLeft: depth > 0 ? `3px solid ${cat.color}44` : undefined,
          borderColor: depth === 0 ? (dragOverCat === cat.id ? cat.color : "#333") : undefined,
          borderRadius: depth > 0 ? 8 : undefined,
          padding: depth > 0 ? 12 : undefined,
          marginTop: depth > 0 ? 8 : undefined,
          transition: "border-color 0.15s, background 0.15s",
        }}
      >
        {/* Category header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isCollapsed ? 0 : 10 }}>
          {/* Collapse toggle */}
          {(childCount > 0 || cat.items.length > 0) && (
            <button
              onClick={() => toggleCollapsed(cat.id)}
              style={{
                background: "none", border: "none", color: "#666",
                cursor: "pointer", fontSize: 12, padding: "0 2px", fontFamily: "monospace",
              }}
            >
              {isCollapsed ? "▸" : "▾"}
            </button>
          )}
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
          <input
            value={cat.name}
            onChange={(e) => handleRenameCategory(cat.id, e.target.value)}
            style={{
              background: "none", border: "none", color: cat.color,
              fontSize: depth === 0 ? 14 : 13, fontWeight: 700, outline: "none", width: "auto",
              borderBottom: "1px solid transparent",
            }}
            onFocus={(e) => { e.currentTarget.style.borderBottomColor = cat.color; }}
            onBlur={(e) => { e.currentTarget.style.borderBottomColor = "transparent"; }}
          />
          <span style={{ fontSize: 11, color: "#555" }}>
            {cat.items.length}{childCount > 0 ? ` (+${totalItems - cat.items.length} nested)` : ""}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
            <button
              onClick={() => {
                setAddSubTo(addSubTo === cat.id ? null : cat.id);
                setSubCat({ name: "", color: cat.color });
              }}
              style={{
                ...btnStyle,
                background: addSubTo === cat.id ? "#22c55e22" : "none",
                color: "#22c55e",
                border: "1px solid #22c55e44",
                padding: "2px 8px",
                fontSize: 11,
              }}
              title="Add subcategory"
            >
              + Sub
            </button>
            <button
              onClick={() => handleMoveCategory(cat.id, -1)}
              disabled={siblingIdx === 0}
              style={{ ...btnStyle, background: "#16162a", color: siblingIdx === 0 ? "#333" : "#888", border: "1px solid #333", padding: "3px 8px" }}
            >
              ↑
            </button>
            <button
              onClick={() => handleMoveCategory(cat.id, 1)}
              disabled={siblingIdx === siblingCount - 1}
              style={{ ...btnStyle, background: "#16162a", color: siblingIdx === siblingCount - 1 ? "#333" : "#888", border: "1px solid #333", padding: "3px 8px" }}
            >
              ↓
            </button>
            <button
              onClick={() => handleDeleteCategory(cat.id)}
              style={{ ...btnStyle, background: "none", color: "#f87171", border: "1px solid #f8717144", padding: "3px 8px" }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Add subcategory form (inline) */}
        {addSubTo === cat.id && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10, padding: "8px 0" }}>
            <div>
              <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 2 }}>Subcategory Name</label>
              <input
                value={subCat.name}
                onChange={(e) => setSubCat({ ...subCat, name: e.target.value })}
                placeholder="e.g. Trees"
                style={{
                  backgroundColor: "#2a2a3e", border: "1px solid #444", borderRadius: 6,
                  padding: "4px 8px", color: "#e0e0e0", fontSize: 12, width: 160,
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateSubcategory(cat.id); }}
                autoFocus
              />
            </div>
            <input
              type="color"
              value={subCat.color}
              onChange={(e) => setSubCat({ ...subCat, color: e.target.value })}
              style={{ width: 30, height: 26, border: "none", borderRadius: 4, cursor: "pointer", backgroundColor: "transparent" }}
            />
            <button
              onClick={() => handleCreateSubcategory(cat.id)}
              disabled={!subCat.name.trim()}
              style={{ ...btnStyle, background: "#22c55e", color: "#111", fontWeight: 700, padding: "4px 10px", fontSize: 11, opacity: !subCat.name.trim() ? 0.4 : 1 }}
            >
              Create
            </button>
            <button
              onClick={() => setAddSubTo(null)}
              style={{ ...btnStyle, background: "#333", color: "#888", padding: "4px 10px", fontSize: 11 }}
            >
              Cancel
            </button>
          </div>
        )}

        {!isCollapsed && (
          <>
            {/* Items */}
            {cat.items.length === 0 && childCount === 0 ? (
              <div style={{ padding: "12px 0", textAlign: "center", color: "#444", fontSize: 12, fontStyle: "italic" }}>
                Drop items here
              </div>
            ) : cat.items.length > 0 ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {cat.items.map((itemKey, idx) => renderItemPill(itemKey, cat.id, idx))}
              </div>
            ) : null}

            {/* Children */}
            {childCount > 0 && (
              <div style={{ marginTop: cat.items.length > 0 ? 10 : 0 }}>
                {cat.children!.map((child, i) => renderCategory(child, depth + 1, childCount, i))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={pageBg}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Category Editor</h1>
          <p style={{ color: "#888", fontSize: 13, margin: "4px 0 0" }}>
            Organize tiles and objects into categories and subcategories. Drag items between any level. Credit limits are enforced at the root category level.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/dev/world-editor" style={{ ...btnStyle, background: "#333", color: "#ccc", textDecoration: "none", padding: "8px 16px" }}>
            ← Dev Tiles
          </a>
        </div>
      </div>

      {/* Actions bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          style={{
            ...btnStyle,
            background: showNewForm ? "#22c55e22" : "#1a2a1e",
            color: "#22c55e",
            border: "1px solid #22c55e",
          }}
        >
          {showNewForm ? "Cancel" : "+ New Category"}
        </button>
        <button
          onClick={handleReset}
          style={{ ...btnStyle, background: "#2a1a1a", color: "#d95c5c", border: "1px solid #d95c5c" }}
        >
          Reset
        </button>
        <button
          onClick={handleSaveToDB}
          disabled={dbSaved === "saving" || dbSaved === "saved"}
          style={{
            ...btnStyle,
            background: dbSaved === "saved" ? "#1a2a1e" : "#3b82f6",
            color: dbSaved === "saved" ? "#22c55e" : "#fff",
            border: dbSaved === "saved" ? "1px solid #22c55e" : "1px solid #3b82f6",
            opacity: dbSaved === "saving" ? 0.6 : 1,
          }}
        >
          {dbSaved === "saved" ? "✓ Synced" : dbSaved === "saving" ? "Saving…" : "Save to DB"}
        </button>
      </div>

      {/* New category form */}
      {showNewForm && (
        <div style={{
          ...cardStyle, marginBottom: 16,
          display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap",
          border: "1px solid #22c55e44",
        }}>
          <div>
            <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 2 }}>Name</label>
            <input
              value={newCat.name}
              onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              placeholder="Category name"
              style={{
                backgroundColor: "#2a2a3e", border: "1px solid #444", borderRadius: 6,
                padding: "6px 10px", color: "#e0e0e0", fontSize: 12, width: 180,
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 2 }}>Color</label>
            <input
              type="color"
              value={newCat.color}
              onChange={(e) => setNewCat({ ...newCat, color: e.target.value })}
              style={{ width: 36, height: 30, border: "none", borderRadius: 4, cursor: "pointer", backgroundColor: "transparent" }}
            />
          </div>
          <button
            onClick={handleCreateCategory}
            disabled={!newCat.name.trim()}
            style={{
              ...btnStyle, background: "#22c55e", color: "#111", fontWeight: 700,
              opacity: !newCat.name.trim() ? 0.4 : 1,
            }}
          >
            Create
          </button>
        </div>
      )}

      {/* Categories (recursive) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {categories.map((cat, i) => renderCategory(cat, 0, categories.length, i))}
      </div>

      {/* Unassigned pool */}
      {(unassignedTiles.length > 0 || unassignedObjects.length > 0) && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: "#888" }}>
            Unassigned Items
          </h2>
          <p style={{ color: "#555", fontSize: 11, marginBottom: 12 }}>
            Drag these into a category or subcategory above.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {unassignedTiles.map((t) => renderItemPill(`tile:${t.id}`))}
            {unassignedObjects.map((o) => renderItemPill(`object:${o.id}`))}
          </div>
        </div>
      )}
    </div>
  );
}
