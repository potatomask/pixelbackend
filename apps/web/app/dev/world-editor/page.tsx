"use client";

import React, { useState, useCallback, useEffect } from "react";
import { TILESET_TILE_SIZE, TILE_EMPTY, initDevTiles, getAllTiles } from "@mypixelpage/shared";
import type { TileDef, TagDef, ObjectDef } from "@mypixelpage/shared";
import { DEFAULT_TAGS } from "@mypixelpage/shared";
import { useNotify } from "@/components/notifications";
import { syncSettingToServer, loadSettingFromServer, autoHealSettings } from "@/lib/utils/dev-settings-sync";

/* ── Styles ─────────────────────────────────────── */
const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "#111118",
  color: "#e0e0e0",
  padding: "32px 40px",
  fontFamily: "system-ui, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 12,
  padding: 24,
  cursor: "pointer",
  transition: "all 0.15s",
  textDecoration: "none",
  color: "#e0e0e0",
  display: "block",
};

const LAYER_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Z0 · Water", color: "#3b82f6" },
  1: { label: "Z1 · Ground", color: "#22c55e" },
  2: { label: "Z2 · Overlay", color: "#f59e0b" },
};

const NAV_ITEMS = [
  {
    href: "/dev/world-editor/tile-editor",
    title: "Tile Editor",
    desc: "Create and configure tile types — z-layers, auto-tiling, categories, and tileset mapping.",
    icon: "🧱",
    color: "#3b82f6",
  },
  {
    href: "/dev/world-editor/autotile",
    title: "Auto-Tile Mapping",
    desc: "Configure bitmask-to-sprite mappings for auto-tiling terrain and path tiles.",
    icon: "🗺️",
    color: "#22c55e",
  },
  {
    href: "/dev/world-editor/animation-editor",
    title: "Animation Editor",
    desc: "Create frame-based animations for tiles and objects. Link to tile/object IDs.",
    icon: "🎬",
    color: "#f59e0b",
  },
  {
    href: "/dev/world-editor/object-editor",
    title: "Object Editor",
    desc: "Define objects (trees, items, interactables) with collision shapes, z-index interaction, and categories.",
    icon: "🌳",
    color: "#c084fc",
  },
  {
    href: "/dev/world-editor/categories",
    title: "Category Editor",
    desc: "Organize tiles and objects into palette categories with drag-and-drop ordering.",
    icon: "📂",
    color: "#06b6d4",
  },
  {
    href: "/dev/world-editor/character-editor",
    title: "Character Editor",
    desc: "Configure player collision box and directional idle/walk animations.",
    icon: "🧍",
    color: "#ef4444",
  },
  {
    href: "/dev/world-editor/sidepage-editor",
    title: "Sidepage Theme Editor",
    desc: "Create and edit sidepage panel themes, buttons, and tile sets.",
    icon: "📖",
    color: "#8b5cf6",
  },
  {
    href: "/dev/world-editor/wind",
    title: "Wind Settings",
    desc: "Configure global wind visual effect — density, speed, direction, color, and fade.",
    icon: "🌬️",
    color: "#38bdf8",
  },
];

/* ── Mini-previews ─────────────────────────── */
function TileMini({ tile }: { tile: TileDef }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 24, 24);
    if (tile.tilesetSrc) {
      const img = new Image();
      img.onload = () => {
        const thumbX = tile.thumbX ?? tile.srcX;
        const thumbY = tile.thumbY ?? tile.srcY;
        ctx.drawImage(img, thumbX, thumbY, TILESET_TILE_SIZE, TILESET_TILE_SIZE, 0, 0, 24, 24);
      };
      img.src = tile.tilesetSrc;
    } else {
      ctx.fillStyle = tile.color;
      ctx.fillRect(0, 0, 24, 24);
    }
  }, [tile]);
  return <canvas ref={ref} width={24} height={24} style={{ borderRadius: 3, imageRendering: "pixelated" }} />;
}

function ObjectMini({ obj }: { obj: ObjectDef }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 24, 24);
    if (obj.tilesetSrc) {
      const img = new Image();
      img.onload = () => {
        const sw = obj.widthTiles * TILESET_TILE_SIZE;
        const sh = obj.heightTiles * TILESET_TILE_SIZE;
        const aspect = sw / sh;
        let dw = 24, dh = 24;
        if (aspect > 1) dh = 24 / aspect;
        else dw = 24 * aspect;
        ctx.drawImage(img, obj.srcX, obj.srcY, sw, sh, (24 - dw) / 2, (24 - dh) / 2, dw, dh);
      };
      img.src = obj.tilesetSrc;
    } else {
      ctx.fillStyle = "#c084fc";
      ctx.fillRect(0, 0, 24, 24);
    }
  }, [obj]);
  return <canvas ref={ref} width={24} height={24} style={{ borderRadius: 3, imageRendering: "pixelated" }} />;
}

function loadObjectDefs(): ObjectDef[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("dev-objects") ?? "[]") as ObjectDef[];
  } catch {
    return [];
  }
}

/* ── Main ──────────────────────────────────────── */
export default function DevTileHub() {
  const [tiles, setTiles] = React.useState<TileDef[]>([]);
  const [objectDefs, setObjectDefs] = React.useState<ObjectDef[]>([]);
  const { confirm } = useNotify();
  React.useEffect(() => {
    initDevTiles();
    setTiles(getAllTiles().filter((t) => t.id !== TILE_EMPTY));
    setObjectDefs(loadObjectDefs());
  }, []);
  const grouped = [0, 1, 2].map((z) => ({
    z,
    ...LAYER_LABELS[z]!,
    tiles: tiles.filter((t) => t.zLayer === z),
  }));

  return (
    <div style={pageBg}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            Dev · Tile Tools
          </h1>
          <p style={{ color: "#888", fontSize: 13, margin: "4px 0 0" }}>
            Manage tiles, objects, animations, and auto-tiling for your pixel world.
          </p>
        </div>
        <a
          href="/dev"
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: "#333",
            color: "#ccc",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          ← Dev Tools
        </a>
      </div>

      {/* Editor cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 40 }}>
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            style={cardStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = item.color;
              e.currentTarget.style.background = "#1e1e3a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#333";
              e.currentTarget.style.background = "#1a1a2e";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{item.icon}</span>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: item.color }}>{item.title}</h2>
            </div>
            <p style={{ color: "#888", fontSize: 13, margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
          </a>
        ))}
      </div>

      {/* Assets overview */}
      <div style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>Assets Overview</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Tiles by z-layer */}
          {grouped.map(({ z, label, color, tiles: lt }) => (
            <div key={z}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
                <span style={{ fontSize: 11, color: "#555" }}>({lt.length})</span>
              </div>
              {lt.length === 0 ? (
                <span style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>No tiles</span>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {lt.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        background: "#16162a",
                        borderRadius: 6,
                        border: "1px solid #2a2a3e",
                        fontSize: 12,
                      }}
                    >
                      <TileMini tile={t} />
                      <div>
                        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{t.name}</span>
                        <span style={{ color: "#555", marginLeft: 6 }}>#{t.id}</span>
                        {t.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                            {t.tags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: 9,
                                  padding: "1px 5px",
                                  borderRadius: 3,
                                  background: "#2a2a4e",
                                  color: "#aaa",
                                }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Objects */}
          {objectDefs.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#c084fc" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#c084fc" }}>Objects</span>
                <span style={{ fontSize: 11, color: "#555" }}>({objectDefs.length})</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {objectDefs.map((obj) => (
                  <div
                    key={obj.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      background: "#16162a",
                      borderRadius: 6,
                      border: "1px solid #2a2a3e",
                      fontSize: 12,
                    }}
                  >
                    <ObjectMini obj={obj} />
                    <div>
                      <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{obj.name}</span>
                      <span style={{ color: "#555", marginLeft: 6 }}>{obj.widthTiles}x{obj.heightTiles}</span>
                      {obj.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                          {obj.tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                fontSize: 9,
                                padding: "1px 5px",
                                borderRadius: 3,
                                background: "#2a2a4e",
                                color: "#aaa",
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tag Placement Rules */}
      <TagRulesEditor />
    </div>
  );
}

/* ── Tag Rules Editor ──────────────────────────── */
const TAG_STORAGE_KEY = "dev-tag-rules";

function loadTagRules(): TagDef[] {
  if (typeof window === "undefined") return DEFAULT_TAGS;
  try {
    const raw = localStorage.getItem(TAG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_TAGS;
  } catch {
    return DEFAULT_TAGS;
  }
}

function saveTagRules(tags: TagDef[]) {
  localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(tags));
  syncSettingToServer(TAG_STORAGE_KEY, JSON.stringify(tags));
}

function TagRulesEditor() {
  const [tags, setTags] = useState<TagDef[]>([]);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTag, setNewTag] = useState({ id: "", name: "", color: "#888888" });

  useEffect(() => {
    loadSettingFromServer("dev-tag-rules").then((serverVal) => {
      setTags(loadTagRules());
      autoHealSettings([["dev-tag-rules", serverVal]]);
    });
  }, []);

  const togglePlacementRule = useCallback((tagId: string, targetId: string) => {
    setTags((prev) => {
      const updated = prev.map((t) => {
        if (t.id !== tagId) return t;
        const has = t.canPlaceOn.includes(targetId);
        return {
          ...t,
          canPlaceOn: has
            ? t.canPlaceOn.filter((id) => id !== targetId)
            : [...t.canPlaceOn, targetId],
        };
      });
      saveTagRules(updated);
      return updated;
    });
  }, []);

  const { confirm } = useNotify();

  const handleReset = useCallback(() => {
    confirm("Are you sure you want to reset all tags to defaults? Any custom tags will be lost.", () => {
      setTags([...DEFAULT_TAGS]);
      saveTagRules([...DEFAULT_TAGS]);
    }, { title: "Reset tags", confirmText: "Reset", cancelText: "Cancel" });
  }, [confirm]);

  const handleCreateTag = useCallback(() => {
    const id = newTag.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const name = newTag.name.trim();
    if (!id || !name) return;
    if (tags.some((t) => t.id === id)) return;
    const created: TagDef = { id, name, color: newTag.color, canPlaceOn: [] };
    const updated = [...tags, created];
    setTags(updated);
    saveTagRules(updated);
    setNewTag({ id: "", name: "", color: "#888888" });
    setShowNewForm(false);
  }, [newTag, tags]);

  const handleDeleteTag = useCallback((tagId: string) => {
    // Don't allow deleting built-in tags
    const builtInIds = DEFAULT_TAGS.map((t) => t.id);
    if (builtInIds.includes(tagId)) return;
    const tag = tags.find((t) => t.id === tagId);
    confirm(
      `Delete tag "${tag?.name || tagId}"? This cannot be undone.`,
      () => {
        const updated = tags
          .filter((t) => t.id !== tagId)
          .map((t) => ({ ...t, canPlaceOn: t.canPlaceOn.filter((id) => id !== tagId) }));
        setTags(updated);
        saveTagRules(updated);
        if (editingTagId === tagId) setEditingTagId(null);
      },
      { title: "Delete Tag", confirmText: "Delete", cancelText: "Cancel" },
    );
  }, [tags, editingTagId, confirm]);

  return (
    <div style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 12, padding: 24, marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Tag Placement Rules</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowNewForm(!showNewForm)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid #22c55e",
              background: showNewForm ? "#22c55e22" : "#1a2a1e",
              color: "#22c55e",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {showNewForm ? "Cancel" : "+ New Tag"}
          </button>
          <button
            onClick={handleReset}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid #d95c5c",
              background: "#2a1a1a",
              color: "#d95c5c",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* New Tag Form */}
      {showNewForm && (
        <div style={{
          padding: 16, background: "#16162a", borderRadius: 8,
          border: "1px solid #22c55e44", marginBottom: 16,
          display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap",
        }}>
          <div>
            <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 2 }}>ID (lowercase)</label>
            <input
              value={newTag.id}
              onChange={(e) => setNewTag({ ...newTag, id: e.target.value })}
              placeholder="my_tag"
              style={{
                backgroundColor: "#2a2a3e", border: "1px solid #444", borderRadius: 6,
                padding: "6px 10px", color: "#e0e0e0", fontSize: 12, width: 120,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 2 }}>Name</label>
            <input
              value={newTag.name}
              onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
              placeholder="My Tag"
              style={{
                backgroundColor: "#2a2a3e", border: "1px solid #444", borderRadius: 6,
                padding: "6px 10px", color: "#e0e0e0", fontSize: 12, width: 140,
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 2 }}>Color</label>
            <input
              type="color"
              value={newTag.color}
              onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
              style={{ width: 36, height: 30, border: "none", borderRadius: 4, cursor: "pointer", backgroundColor: "transparent" }}
            />
          </div>
          <button
            onClick={handleCreateTag}
            disabled={!newTag.id.trim() || !newTag.name.trim() || tags.some((t) => t.id === newTag.id.trim().toLowerCase())}
            style={{
              padding: "6px 16px", borderRadius: 6, border: "none",
              background: "#22c55e", color: "#111", fontWeight: 700,
              fontSize: 12, cursor: "pointer",
              opacity: (!newTag.id.trim() || !newTag.name.trim()) ? 0.4 : 1,
            }}
          >
            Create
          </button>
          {tags.some((t) => t.id === newTag.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")) && newTag.id.trim() && (
            <span style={{ fontSize: 10, color: "#d95c5c" }}>Tag ID already exists</span>
          )}
        </div>
      )}
      <p style={{ color: "#888", fontSize: 12, margin: "0 0 16px", lineHeight: 1.5 }}>
        Configure which tags can be placed on which other tags. Empty &quot;Can Place On&quot; means the tag can be placed anywhere.
        For example, decorations can only go on ground/path/bridge. Bridges can only go on water.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tags.map((tag) => (
          <div
            key={tag.id}
            style={{
              padding: "12px 16px",
              background: editingTagId === tag.id ? "#1e1e3a" : "#16162a",
              borderRadius: 8,
              border: editingTagId === tag.id ? `1px solid ${tag.color}` : "1px solid #2a2a3e",
              cursor: "pointer",
            }}
            onClick={() => setEditingTagId(editingTagId === tag.id ? null : tag.id)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: editingTagId === tag.id ? 10 : 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: tag.color }}>{tag.name}</span>
              <span style={{ fontSize: 11, color: "#555" }}>({tag.id})</span>
              <span style={{ fontSize: 11, color: "#666", marginLeft: "auto" }}>
                {tag.canPlaceOn.length === 0
                  ? "Can place anywhere"
                  : `Can place on: ${tag.canPlaceOn.join(", ")}`}
              </span>
              {!DEFAULT_TAGS.some((dt) => dt.id === tag.id) && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id); }}
                  style={{
                    background: "none", border: "none", color: "#f87171",
                    cursor: "pointer", fontSize: 14, padding: "0 4px", marginLeft: 8,
                  }}
                  title="Delete custom tag"
                >
                  ×
                </button>
              )}
            </div>
            {editingTagId === tag.id && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tags
                  .filter((t) => t.id !== tag.id)
                  .map((target) => {
                    const active = tag.canPlaceOn.includes(target.id);
                    return (
                      <button
                        key={target.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePlacementRule(tag.id, target.id);
                        }}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 12,
                          border: active ? `1px solid ${target.color}` : "1px solid #333",
                          background: active ? target.color + "22" : "#1a1a28",
                          color: active ? target.color : "#555",
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        {target.name}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
