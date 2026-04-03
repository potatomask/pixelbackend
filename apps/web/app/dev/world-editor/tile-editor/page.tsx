"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { TILE_REGISTRY, TILESET_TILE_SIZE, TILE_EMPTY, registerDevTiles } from "@mypixelpage/shared";
import type { TileDef } from "@mypixelpage/shared";
import type { AnimationDef } from "@mypixelpage/shared";
import { DEFAULT_TAGS, loadTagsFromStorage } from "@mypixelpage/shared";
import type { TagDef } from "@mypixelpage/shared";
import { saveDevSetting, loadSettingFromServer, autoHealSettings } from "@/lib/utils/dev-settings-sync";
import { useNotify } from "@/components/notifications";

const ANIM_STORAGE_KEY = "dev-animations";
const TILES_STORAGE_KEY = "dev-tiles";
const FREE_TIER_OK_MIGRATION_KEY = "dev-free-tier-ok-migration-tiles-v1";

function loadSavedTiles(): TileDef[] {
  if (typeof window === "undefined") return [...TILE_REGISTRY];
  try {
    const raw = localStorage.getItem(TILES_STORAGE_KEY);
    if (raw) {
      const saved: TileDef[] = JSON.parse(raw);
      // Merge: saved tiles override registry tiles by ID, keep any registry tiles not in saved
      const savedById = new Map(saved.map((t) => [t.id, t]));
      const merged = [...TILE_REGISTRY].map((t) => savedById.get(t.id) ?? t);
      // Add any saved tiles not in registry
      for (const t of saved) {
        if (!merged.some((m) => m.id === t.id)) merged.push(t);
      }
      return merged.sort((a, b) => a.id - b.id);
    }
  } catch { /* ignore */ }
  return [...TILE_REGISTRY];
}

function saveTiles(tiles: TileDef[]) {
  saveDevSetting(TILES_STORAGE_KEY, JSON.stringify(tiles));
  registerDevTiles(tiles);
}

/* ── Styles ────────────────────────────────────────── */
const LAYER_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Z0 · Water", color: "#3b82f6" },
  1: { label: "Z1 · Ground", color: "#22c55e" },
  2: { label: "Z2 · Overlay", color: "#f59e0b" },
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#1e1e2e",
  border: "1px solid #333",
  borderRadius: 12,
  padding: 16,
};

/* ── Tile preview canvas ────────────────────────────── */
function TilePreview({ tile, size = 48 }: { tile: TileDef; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    if (tile.tilesetSrc) {
      const img = new Image();
      img.onload = () => {
        const previewX = tile.thumbX ?? tile.srcX;
        const previewY = tile.thumbY ?? tile.srcY;
        ctx.drawImage(
          img,
          previewX, previewY, TILESET_TILE_SIZE, TILESET_TILE_SIZE,
          0, 0, size, size
        );
      };
      img.src = tile.tilesetSrc;
    } else {
      ctx.fillStyle = tile.color;
      ctx.fillRect(0, 0, size, size);
    }
  }, [tile, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{
        display: "block",
        borderRadius: 4,
        imageRendering: "pixelated",
        border: "1px solid #444",
        backgroundColor: "#111",
      }}
    />
  );
}

/* ── Tileset spritesheet preview ────────────────────── */
function TilesetSheetPreview({
  src,
  scale = 3,
  selectedX,
  selectedY,
  onPick,
}: {
  src: string;
  scale?: number;
  selectedX?: number;
  selectedY?: number;
  onPick?: (srcX: number, srcY: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const img = new Image();
    img.onload = () => {
      const w = img.width * scale;
      const h = img.height * scale;
      cvs.width = w;
      cvs.height = h;
      setImgSize({ w, h });
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, w, h);

      // Draw grid lines
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      const ts = TILESET_TILE_SIZE * scale;
      for (let x = 0; x <= w; x += ts) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += ts) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }

      if (typeof selectedX === "number" && typeof selectedY === "number") {
        const selX = (selectedX / TILESET_TILE_SIZE) * ts;
        const selY = (selectedY / TILESET_TILE_SIZE) * ts;
        ctx.strokeStyle = "#ffdd00";
        ctx.lineWidth = 2;
        ctx.strokeRect(selX + 1, selY + 1, ts - 2, ts - 2);
        ctx.fillStyle = "rgba(255,221,0,0.15)";
        ctx.fillRect(selX, selY, ts, ts);
      }
    };
    img.src = src;
  }, [src, scale, selectedX, selectedY]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onPick) return;
    const cvs = ref.current;
    if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const sx = cvs.width / rect.width;
    const sy = cvs.height / rect.height;
    const px = (e.clientX - rect.left) * sx;
    const py = (e.clientY - rect.top) * sy;
    const tilePx = TILESET_TILE_SIZE * scale;
    const col = Math.floor(px / tilePx);
    const row = Math.floor(py / tilePx);
    onPick(col * TILESET_TILE_SIZE, row * TILESET_TILE_SIZE);
  }, [onPick, scale]);

  return (
    <canvas
      ref={ref}
      onClick={handleClick}
      style={{
        display: "block",
        imageRendering: "pixelated",
        borderRadius: 4,
        border: "1px solid #444",
        backgroundColor: "#0a0a0a",
        cursor: onPick ? "crosshair" : "default",
      }}
    />
  );
}

/* ── New tile form ──────────────────────────────────── */
interface TileFormData {
  id: number;
  name: string;
  color: string;
  tileCost: number;
  walkable: boolean;
  tilesetSrc: string;
  srcX: number;
  srcY: number;
  thumbX: number;
  thumbY: number;
  autoTile: boolean;
  autoTileMode: "cardinal" | "quadrant" | "linear";
  zLayer: number;
  tags: string[];
  canPlaceOn: string[];
  animationId: string | null;
  freeTierOk: boolean;
}

const defaultForm: TileFormData = {
  id: 10,
  name: "",
  color: "#808080",
  tileCost: 1,
  walkable: true,
  tilesetSrc: "",
  srcX: 0,
  srcY: 0,
  thumbX: 0,
  thumbY: 0,
  autoTile: false,
  autoTileMode: "quadrant" as const,
  zLayer: 1,
  tags: [],
  canPlaceOn: [],
  animationId: null,
  freeTierOk: true,
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "#2a2a3e",
  border: "1px solid #444",
  borderRadius: 6,
  padding: "5px 8px",
  color: "#e0e0e0",
  fontSize: 12,
  width: "100%",
};

const btnStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
  transition: "all 0.15s",
};

/* ── Main page ──────────────────────────────────────── */
export default function TileEditorPage() {
  const [tiles, setTiles] = useState<TileDef[]>(() => [...TILE_REGISTRY]);
  const [form, setForm] = useState<TileFormData>(defaultForm);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [animations, setAnimations] = useState<AnimationDef[]>([]);
  const [allTags, setAllTags] = useState<TagDef[]>(DEFAULT_TAGS);
  const { confirm } = useNotify();

  useEffect(() => {
    // Load from server first, then read from localStorage
    Promise.all([
      loadSettingFromServer("dev-tiles"),
      loadSettingFromServer("dev-animations"),
    ]).then(([serverTiles, serverAnims]) => {
      const loaded = loadSavedTiles();
      let normalized = loaded;
      if (typeof window !== "undefined" && !localStorage.getItem(FREE_TIER_OK_MIGRATION_KEY)) {
        normalized = loaded.map((t) => ({ ...t, freeTierOk: true }));
        saveTiles(normalized);
        localStorage.setItem(FREE_TIER_OK_MIGRATION_KEY, "1");
      }
      setTiles(normalized);
      try {
        const raw = localStorage.getItem(ANIM_STORAGE_KEY);
        if (raw) setAnimations(JSON.parse(raw));
      } catch { /* ignore */ }
      setAllTags(loadTagsFromStorage());
      autoHealSettings([["dev-tiles", serverTiles], ["dev-animations", serverAnims]]);
    });
  }, []);

  // Compute next free ID
  const nextId = tiles.reduce((max, t) => Math.max(max, t.id), 0) + 1;

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus("Uploading…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tiles/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setForm((f) => ({ ...f, tilesetSrc: data.url }));
        setUploadStatus(`Uploaded: ${data.filename}`);
      } else {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        // Fallback: just use the filename directly
        setForm((f) => ({ ...f, tilesetSrc: `/tilesets/${file.name}` }));
        setUploadStatus(err.error ?? "Upload failed, using local path");
      }
    } catch {
      setForm((f) => ({ ...f, tilesetSrc: `/tilesets/${file.name}` }));
      setUploadStatus(`Fallback: /tilesets/${file.name}`);
    }
  }, []);

  const handleAddTile = useCallback(() => {
    if (!form.name.trim()) return;

    const newTile: TileDef = {
      id: editingId ?? nextId,
      name: form.name.trim(),
      color: form.color,
      tileCost: form.tileCost,
      walkable: form.walkable,
      tilesetSrc: form.tilesetSrc || undefined,
      srcX: form.srcX,
      srcY: form.srcY,
      thumbX: form.thumbX,
      thumbY: form.thumbY,
      autoTile: form.autoTile,
      autoTileMode: form.autoTileMode,
      zLayer: form.zLayer,
      tags: form.tags,
      canPlaceOn: form.canPlaceOn,
      animationId: form.animationId || undefined,
      freeTierOk: form.freeTierOk,
    };

    setTiles((prev) => {
      const without = prev.filter((t) => t.id !== newTile.id);
      const updated = [...without, newTile].sort((a, b) => a.id - b.id);
      saveTiles(updated);
      return updated;
    });
    setForm({ ...defaultForm, id: nextId + 1 });
    setEditingId(null);
  }, [form, editingId, nextId]);

  const handleEdit = useCallback((tile: TileDef) => {
    setEditingId(tile.id);
    setForm({
      id: tile.id,
      name: tile.name,
      color: tile.color,
      tileCost: tile.tileCost,
      walkable: tile.walkable,
      tilesetSrc: tile.tilesetSrc ?? "",
      srcX: tile.srcX,
      srcY: tile.srcY,
      thumbX: tile.thumbX ?? tile.srcX,
      thumbY: tile.thumbY ?? tile.srcY,
      autoTile: tile.autoTile ?? false,
      autoTileMode: tile.autoTileMode ?? "quadrant",
      zLayer: tile.zLayer,
      tags: tile.tags ?? [],
      canPlaceOn: (tile as any).canPlaceOn ?? [],
      animationId: (tile as TileDef & { animationId?: string | null }).animationId ?? null,
      freeTierOk: (tile as any).freeTierOk ?? true,
    });
  }, []);

  const handleDelete = useCallback((id: number) => {
    if (id === TILE_EMPTY) return;
    confirm(
      `Delete tile #${id}? This cannot be undone.`,
      () => {
        setTiles((prev) => {
          const updated = prev.filter((t) => t.id !== id);
          saveTiles(updated);
          return updated;
        });
        if (editingId === id) {
          setEditingId(null);
          setForm(defaultForm);
        }
      },
      { title: "Delete Tile", confirmText: "Delete", cancelText: "Cancel" },
    );
  }, [editingId, confirm]);

  // Group tiles by z-layer (dynamically)
  const zLayers = [...new Set(tiles.map((t) => t.zLayer))].sort((a, b) => a - b);
  const grouped = zLayers.map((z) => ({
    z,
    label: LAYER_LABELS[z]?.label ?? `Z${z}`,
    color: LAYER_LABELS[z]?.color ?? "#888",
    tiles: tiles.filter((t) => t.zLayer === z && t.id !== TILE_EMPTY),
  }));

  // Get unique tileset sources for preview
  const tilesetSources = [...new Set(tiles.map((t) => t.tilesetSrc).filter(Boolean) as string[])];

  return (
    <main style={{
      minHeight: "100vh",
      backgroundColor: "#121218",
      color: "#e0e0e0",
      padding: "24px 28px",
      maxWidth: 1400,
      margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
            Tile Editor
          </h1>
          <p style={{ color: "#888", fontSize: 13, margin: "4px 0 0" }}>
            Manage tile types, upload tilesets, configure z-layers and auto-tiling
          </p>
        </div>
        <a href="/dev/world-editor" style={{
          ...btnStyle,
          backgroundColor: "#333",
          color: "#ccc",
          textDecoration: "none",
        }}>
          ← Dev Tiles
        </a>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Left: Tile listing by layer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, order: 2 }}>
          {grouped.map(({ z, label, color, tiles: layerTiles }) => (
            <div key={z} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  backgroundColor: color, flexShrink: 0,
                }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{label}</h2>
                <span style={{ fontSize: 12, color: "#666", marginLeft: "auto" }}>
                  {layerTiles.length} tile{layerTiles.length !== 1 ? "s" : ""}
                </span>
              </div>

              {layerTiles.length === 0 ? (
                <p style={{ color: "#555", fontSize: 13, fontStyle: "italic" }}>No tiles in this layer</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {layerTiles.map((tile) => (
                    <div
                      key={tile.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        backgroundColor: editingId === tile.id ? "#2a2a4e" : "#1a1a28",
                        borderRadius: 8,
                        border: editingId === tile.id ? `1px solid ${color}` : "1px solid #2a2a3e",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onClick={() => handleEdit(tile)}
                    >
                      <TilePreview tile={tile} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>
                          {tile.name}
                        </div>
                        <div style={{ fontSize: 11, color: "#666", display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span>ID: {tile.id}</span>
                          <span>Cost: {tile.tileCost}</span>
                          {tile.autoTile && <span style={{ color: "#a78bfa" }}>auto</span>}
                          {tile.walkable && <span style={{ color: "#4ade80" }}>walk</span>}
                          {!tile.walkable && <span style={{ color: "#f87171" }}>block</span>}
                        </div>
                        {tile.tags && tile.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 3, marginTop: 3 }}>
                            {tile.tags.map((tag) => {
                              const td = allTags.find((t) => t.id === tag);
                              return (
                                <span
                                  key={tag}
                                  style={{
                                    fontSize: 9,
                                    padding: "1px 5px",
                                    borderRadius: 3,
                                    background: (td?.color ?? "#888") + "22",
                                    color: td?.color ?? "#888",
                                    border: `1px solid ${(td?.color ?? "#888")}44`,
                                  }}
                                >
                                  {td?.name ?? tag}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {tile.id !== TILE_EMPTY && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(tile.id); }}
                          style={{
                            background: "none", border: "none", color: "#666",
                            cursor: "pointer", fontSize: 16, padding: "2px 6px",
                          }}
                          title="Delete"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Tileset previews */}
          {tilesetSources.length > 0 && (
            <div style={cardStyle}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>Tileset Spritesheets</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                {tilesetSources.map((src) => (
                  <div key={src} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <TilesetSheetPreview src={src} scale={2} />
                    <code style={{ fontSize: 11, color: "#888" }}>{src}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Add / Edit form */}
        <div style={{
          ...cardStyle,
          order: 1,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>
            {editingId !== null ? `Edit Tile #${editingId}` : "Add New Tile"}
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "start" }}>
            {/* Name */}
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Name</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. sand"
              />
            </div>

            {/* ID */}
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Tile ID</label>
              <input
                style={inputStyle}
                type="number"
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: parseInt(e.target.value, 10) || 0 }))}
                disabled={editingId !== null}
              />
            </div>

            {/* Color */}
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Fallback Color</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  style={{ width: 36, height: 30, border: "none", borderRadius: 4, cursor: "pointer" }}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                />
              </div>
            </div>

            {/* Tile cost */}
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Tile Cost</label>
              <input
                style={inputStyle}
                type="number"
                min={0}
                step={0.1}
                value={form.tileCost}
                onChange={(e) => setForm((f) => ({ ...f, tileCost: Number(e.target.value) || 0 }))}
              />
            </div>

            {/* Z-Layer */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Z-Layer</label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  style={{ ...inputStyle, width: 70 }}
                  type="number"
                  min={0}
                  value={form.zLayer}
                  onChange={(e) => setForm((f) => ({ ...f, zLayer: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                />
                {[0, 1, 2].map((z) => (
                  <button
                    key={z}
                    onClick={() => setForm((f) => ({ ...f, zLayer: z }))}
                    style={{
                      ...btnStyle,
                      flex: 1,
                      backgroundColor: form.zLayer === z ? LAYER_LABELS[z]!.color : "#2a2a3e",
                      color: form.zLayer === z ? "#fff" : "#888",
                      fontSize: 11,
                      padding: "6px 8px",
                    }}
                  >
                    {LAYER_LABELS[z]!.label}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 10, color: "#555", marginTop: 2, display: "block" }}>
                0=water, 1=ground, 2=overlay. Any value ≥ 0 is valid.
              </span>
            </div>

            {/* Tileset source */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Tileset Image</label>
              <input
                style={inputStyle}
                value={form.tilesetSrc}
                onChange={(e) => setForm((f) => ({ ...f, tilesetSrc: e.target.value }))}
                placeholder="/tilesets/mysprite.png"
              />
              <div style={{ marginTop: 6 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png"
                  onChange={handleUpload}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ ...btnStyle, backgroundColor: "#2a2a3e", color: "#aaa", fontSize: 12, padding: "5px 12px" }}
                >
                  Upload PNG…
                </button>
                {uploadStatus && (
                  <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>{uploadStatus}</span>
                )}
              </div>
            </div>

            {/* Source XY */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>srcX (px)</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.srcX}
                  onChange={(e) => setForm((f) => ({ ...f, srcX: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>srcY (px)</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.srcY}
                  onChange={(e) => setForm((f) => ({ ...f, srcY: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
            </div>

            {/* Thumbnail XY */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>thumbX (px)</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.thumbX}
                  onChange={(e) => setForm((f) => ({ ...f, thumbX: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>thumbY (px)</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.thumbY}
                  onChange={(e) => setForm((f) => ({ ...f, thumbY: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
              <button
                onClick={() => setForm((f) => ({ ...f, thumbX: f.srcX, thumbY: f.srcY }))}
                style={{ ...btnStyle, backgroundColor: "#2a2a3e", color: "#aaa", fontSize: 11, padding: "6px 10px", whiteSpace: "nowrap" }}
                title="Use srcX/srcY for thumbnail"
              >
                Use Source
              </button>
            </div>

            {form.tilesetSrc && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>
                  Thumbnail Picker (click a tile)
                </label>
                <TilesetSheetPreview
                  src={form.tilesetSrc}
                  scale={2}
                  selectedX={form.thumbX}
                  selectedY={form.thumbY}
                  onPick={(x, y) => setForm((f) => ({ ...f, thumbX: x, thumbY: y }))}
                />
              </div>
            )}

            {/* Toggles */}
            <div style={{ display: "flex", gap: 16, alignItems: "center", gridColumn: "1 / -1" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.walkable}
                  onChange={(e) => setForm((f) => ({ ...f, walkable: e.target.checked }))}
                />
                Walkable
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.autoTile}
                  onChange={(e) => setForm((f) => ({ ...f, autoTile: e.target.checked }))}
                />
                Auto-tile
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.freeTierOk}
                  onChange={(e) => setForm((f) => ({ ...f, freeTierOk: e.target.checked }))}
                  style={{ accentColor: "#22c55e" }}
                />
                Free Tier OK
              </label>
            </div>

            {/* Auto-Tile Mode */}
            {form.autoTile && (
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Auto-Tile Mode</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["quadrant", "cardinal", "linear"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setForm((f) => ({ ...f, autoTileMode: mode }))}
                      style={{
                        ...btnStyle,
                        flex: 1,
                        backgroundColor: form.autoTileMode === mode ? (mode === "quadrant" ? "#a78bfa" : mode === "cardinal" ? "#4fc3f7" : "#f59e0b") : "#2a2a3e",
                        color: form.autoTileMode === mode ? "#fff" : "#888",
                        fontSize: 12,
                        padding: "6px 10px",
                      }}
                    >
                      {mode === "quadrant" ? "Quadrant (8-bit)" : mode === "cardinal" ? "Cardinal (4-bit)" : "Linear (4-bit)"}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 10, color: "#555", marginTop: 4, display: "block" }}>
                  Quadrant = terrain (grass, stone). Cardinal = paths. Linear = bridges (no corners).
                </span>
              </div>
            )}

            {/* Tags (what this tile IS) */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Tags (what this tile is)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {allTags.map((tag) => {
                  const active = form.tags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          tags: active
                            ? f.tags.filter((t) => t !== tag.id)
                            : [...f.tags, tag.id],
                        }))
                      }
                      style={{
                        padding: "3px 10px",
                        borderRadius: 12,
                        border: active ? `1px solid ${tag.color}` : "1px solid #333",
                        background: active ? tag.color + "22" : "#1a1a28",
                        color: active ? tag.color : "#666",
                        fontSize: 11,
                        fontWeight: active ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Can Place On (where this tile can be placed) */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Can Place On (empty = anywhere)</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {allTags.map((tag) => {
                  const active = form.canPlaceOn.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          canPlaceOn: active
                            ? f.canPlaceOn.filter((t) => t !== tag.id)
                            : [...f.canPlaceOn, tag.id],
                        }))
                      }
                      style={{
                        padding: "3px 10px",
                        borderRadius: 12,
                        border: active ? `1px solid ${tag.color}` : "1px solid #333",
                        background: active ? tag.color + "22" : "#1a1a28",
                        color: active ? tag.color : "#666",
                        fontSize: 11,
                        fontWeight: active ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Animation Link */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Animation</label>
              <select
                style={{ ...inputStyle, cursor: "pointer" }}
                value={form.animationId ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, animationId: e.target.value || null }))}
              >
                <option value="">None (static)</option>
                {animations.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.frames.length} frames)</option>
                ))}
              </select>
              {animations.length === 0 && (
                <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
                  No animations yet.{" "}
                  <a href="/dev/world-editor/animation-editor" style={{ color: "#4fc3f7", textDecoration: "none" }}>
                    Create one →
                  </a>
                </p>
              )}
            </div>

            {/* Merge Behavior */}
            {form.autoTile && (
              <div style={{ padding: 10, background: "#16162a", borderRadius: 8, border: "1px solid #2a2a4e", gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600, marginBottom: 4 }}>
                  Auto-Tile Merge
                </div>
                <p style={{ fontSize: 11, color: "#888", margin: "0 0 6px", lineHeight: 1.4 }}>
                  This tile uses auto-tiling. Terrain tiles (grass, stone, gravel) use 8-bit quadrant merging.
                  Path tiles use 4-bit cardinal merging. Configure precise mappings in the{" "}
                  <a href="/dev/world-editor/autotile" style={{ color: "#4fc3f7", textDecoration: "none" }}>
                    Auto-Tile Mapping Editor
                  </a>.
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8, marginTop: 4, gridColumn: "1 / -1" }}>
              <button
                onClick={handleAddTile}
                disabled={!form.name.trim()}
                style={{
                  ...btnStyle,
                  flex: 1,
                  backgroundColor: editingId !== null ? "#f59e0b" : "#3b82f6",
                  color: "#fff",
                  opacity: form.name.trim() ? 1 : 0.4,
                }}
              >
                {editingId !== null ? "Update Tile" : "Add Tile"}
              </button>
              {editingId !== null && (
                <button
                  onClick={() => { setEditingId(null); setForm({ ...defaultForm, id: nextId }); }}
                  style={{ ...btnStyle, backgroundColor: "#333", color: "#aaa" }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Live preview */}
          {form.tilesetSrc && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #333" }}>
              <h3 style={{ fontSize: 13, color: "#888", margin: "0 0 8px" }}>Tile Preview</h3>
              <TilePreview
                tile={{
                  id: form.id,
                  name: form.name,
                  color: form.color,
                  tileCost: form.tileCost,
                  walkable: form.walkable,
                  tilesetSrc: form.tilesetSrc,
                  srcX: form.srcX,
                  srcY: form.srcY,
                  thumbX: form.thumbX,
                  thumbY: form.thumbY,
                  zLayer: form.zLayer,
                  tags: form.tags,
                  canPlaceOn: form.canPlaceOn,
                }}
                size={64}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
