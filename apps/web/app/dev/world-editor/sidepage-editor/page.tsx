"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { TILESET_TILE_SIZE, getUniqueTilesetSources } from "@mypixelpage/shared";
import type { SidePageTheme, ThemeSpriteRef, NineSliceTiles } from "@mypixelpage/shared";
import { saveDevSetting, loadSettingFromServer, autoHealSettings } from "@/lib/utils/dev-settings-sync";
import { useNotify } from "@/components/notifications";

/* ── Constants & Storage ────────────────────────── */
const STORAGE_KEY = "dev-sidepage-themes";
const CUSTOM_SRC_KEY = "dev-custom-tileset-sources";
const FREE_TIER_OK_MIGRATION_KEY = "dev-free-tier-ok-migration-themes-v1";

function loadCustomSources(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_SRC_KEY) ?? "[]");
  } catch { return []; }
}
function saveCustomSources(srcs: string[]) {
  saveDevSetting(CUSTOM_SRC_KEY, JSON.stringify(srcs));
}

const DEFAULT_THEME: SidePageTheme = {
  id: "default",
  name: "Default Theme",
  isDefault: true,
  freeTierOk: true,
  visualOverflowPx: 0,
  designScale: 1,
  designOffsetXPx: 0,
  designOffsetYPx: 0,
  tiles: {},
  buttons: { link: {}, settings: {}, theme: {} },
};

function loadThemes(): SidePageTheme[] {
  if (typeof window === "undefined") return [DEFAULT_THEME];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [DEFAULT_THEME];
  } catch {
    return [DEFAULT_THEME];
  }
}
function saveThemes(themes: SidePageTheme[]) {
  const payload = JSON.stringify(themes);
  try {
    saveDevSetting(STORAGE_KEY, payload);
  } catch (error) {
    console.error("[sidepage-editor] Failed to save themes (storage quota exceeded)", error);
  }
}

/* ── Styles ─────────────────────────────────────── */
const cardStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 12,
  padding: 16,
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
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

/* ── TilesetGridPicker — the actual tile chooser ── */
function TilesetGridPicker({
  src,
  srcX,
  srcY,
  widthTiles = 1,
  heightTiles = 1,
  onSelect,
}: {
  src: string;
  srcX: number;
  srcY: number;
  widthTiles?: number;
  heightTiles?: number;
  onSelect: (x: number, y: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const SCALE = 3;

  useEffect(() => {
    if (!src) { setImg(null); return; }
    const i = new Image();
    i.onload = () => setImg(i);
    i.onerror = () => setImg(null);
    i.src = src;
  }, [src]);

  const gridCols = img ? Math.ceil(img.width / TILESET_TILE_SIZE) : 0;
  const gridRows = img ? Math.ceil(img.height / TILESET_TILE_SIZE) : 0;
  const cellPx = TILESET_TILE_SIZE * SCALE;
  const w = gridCols * cellPx;
  const h = gridRows * cellPx;

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !img) return;
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // Checkerboard background
    const bs = 8;
    for (let y = 0; y < h; y += bs) {
      for (let x = 0; x < w; x += bs) {
        ctx.fillStyle = ((x + y) / bs) % 2 === 0 ? "#1a1a2e" : "#222244";
        ctx.fillRect(x, y, bs, bs);
      }
    }

    // Draw tileset
    ctx.drawImage(img, 0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= gridCols; c++) {
      ctx.beginPath(); ctx.moveTo(c * cellPx, 0); ctx.lineTo(c * cellPx, h); ctx.stroke();
    }
    for (let r = 0; r <= gridRows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cellPx); ctx.lineTo(w, r * cellPx); ctx.stroke();
    }

    // Highlight selected region (multi-tile)
    const selCol = Math.floor(srcX / TILESET_TILE_SIZE);
    const selRow = Math.floor(srcY / TILESET_TILE_SIZE);
    ctx.strokeStyle = "#ffdd00";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      selCol * cellPx + 1, selRow * cellPx + 1,
      widthTiles * cellPx - 2, heightTiles * cellPx - 2,
    );
    ctx.fillStyle = "rgba(255,221,0,0.1)";
    ctx.fillRect(selCol * cellPx, selRow * cellPx, widthTiles * cellPx, heightTiles * cellPx);

    // Cell coordinate labels
    ctx.font = "8px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        ctx.fillText(`${c},${r}`, c * cellPx + 2, r * cellPx + 8);
      }
    }
  }, [img, srcX, srcY, widthTiles, heightTiles, gridCols, gridRows, cellPx, w, h]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cvs = canvasRef.current;
      if (!cvs || !img) return;
      const rect = cvs.getBoundingClientRect();
      const sx = cvs.width / rect.width;
      const sy = cvs.height / rect.height;
      const col = Math.floor(((e.clientX - rect.left) * sx) / cellPx);
      const row = Math.floor(((e.clientY - rect.top) * sy) / cellPx);
      if (col >= 0 && col < gridCols && row >= 0 && row < gridRows) {
        onSelect(col * TILESET_TILE_SIZE, row * TILESET_TILE_SIZE);
      }
    },
    [img, gridCols, gridRows, cellPx, onSelect],
  );

  if (!src || !img) return <div style={{ color: "#666", padding: 16, textAlign: "center" }}>Select a tileset source above to browse tiles.</div>;

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        cursor: "crosshair",
        maxWidth: "100%",
        borderRadius: 6,
        border: "1px solid #444",
        imageRendering: "pixelated",
      }}
    />
  );
}

/* ── Sprite Preview (renders multi-tile region) ─── */
function SpritePreview({ spriteRef, size = 48 }: { spriteRef?: ThemeSpriteRef; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wt = spriteRef?.widthTiles ?? 1;
  const ht = spriteRef?.heightTiles ?? 1;
  const scale = spriteRef?.scale ?? 1;

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    if (!spriteRef?.src) return;

    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      const sw = wt * TILESET_TILE_SIZE;
      const sh = ht * TILESET_TILE_SIZE;
      const aspect = sw / sh;
      let dw = size, dh = size;
      if (aspect > 1) { dh = size / aspect; } else { dw = size * aspect; }
      // Apply scale
      dw *= scale;
      dh *= scale;
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;
      ctx.drawImage(img, spriteRef.x, spriteRef.y, sw, sh, dx, dy, dw, dh);
    };
    img.src = spriteRef.src;
  }, [spriteRef, size, wt, ht, scale]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{
        display: "block",
        imageRendering: "pixelated",
        backgroundColor: "#111",
        border: "1px solid #444",
        borderRadius: 4,
      }}
    />
  );
}

function drawPreviewSlice(
  ctx: CanvasRenderingContext2D,
  imgMap: Map<string, HTMLImageElement>,
  ref: ThemeSpriteRef | undefined,
  ts: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  if (!ref?.src) return;
  const img = imgMap.get(ref.src);
  if (!img) return;
  const sw = (ref.widthTiles ?? 1) * ts;
  const sh = (ref.heightTiles ?? 1) * ts;
  ctx.drawImage(img, ref.x, ref.y, sw, sh, dx, dy, dw, dh);
}

function drawPreviewNineSlice(
  ctx: CanvasRenderingContext2D,
  tiles: NineSliceTiles,
  imgMap: Map<string, HTMLImageElement>,
  ts: number,
  w: number,
  h: number,
) {
  const edge = ts * (tiles.center?.scale ?? 3);
  const innerW = Math.max(0, w - edge * 2);
  const innerH = Math.max(0, h - edge * 2);

  drawPreviewSlice(ctx, imgMap, tiles.topLeft, ts, 0, 0, edge, edge);
  drawPreviewSlice(ctx, imgMap, tiles.topRight, ts, w - edge, 0, edge, edge);
  drawPreviewSlice(ctx, imgMap, tiles.bottomLeft, ts, 0, h - edge, edge, edge);
  drawPreviewSlice(ctx, imgMap, tiles.bottomRight, ts, w - edge, h - edge, edge, edge);

  drawPreviewSlice(ctx, imgMap, tiles.top, ts, edge, 0, innerW, edge);
  drawPreviewSlice(ctx, imgMap, tiles.bottom, ts, edge, h - edge, innerW, edge);
  drawPreviewSlice(ctx, imgMap, tiles.left, ts, 0, edge, edge, innerH);
  drawPreviewSlice(ctx, imgMap, tiles.right, ts, w - edge, edge, edge, innerH);

  drawPreviewSlice(ctx, imgMap, tiles.center, ts, edge, edge, innerW, innerH);
}

function ThemeLayoutPreview({
  theme,
  overflowPx,
  designScale,
  designOffsetX,
  designOffsetY,
  size = 150,
}: {
  theme: SidePageTheme;
  overflowPx: number;
  designScale: number;
  designOffsetX: number;
  designOffsetY: number;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawOverflowPx = Math.round(overflowPx * 0.45);
  const drawSize = size + drawOverflowPx * 2;
  const insetPx = 16;
  const safeSize = Math.max(24, size - insetPx * 2);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || drawSize <= 0) return;
    cvs.width = drawSize;
    cvs.height = drawSize;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, drawSize, drawSize);

    const sources = new Set<string>();
    for (const ref of Object.values(theme.tiles)) {
      if (ref?.src) sources.add(ref.src);
    }

    if (sources.size === 0) {
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(0, 0, drawSize, drawSize);
      return;
    }

    const imgMap = new Map<string, HTMLImageElement>();
    let loaded = 0;
    const total = sources.size;
    sources.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        imgMap.set(src, img);
        loaded++;
        if (loaded === total) {
          drawPreviewNineSlice(ctx, theme.tiles, imgMap, TILESET_TILE_SIZE, drawSize, drawSize);
        }
      };
      img.onerror = () => {
        loaded++;
        if (loaded === total) {
          drawPreviewNineSlice(ctx, theme.tiles, imgMap, TILESET_TILE_SIZE, drawSize, drawSize);
        }
      };
      img.src = src;
    });
  }, [theme, drawSize]);

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          border: "2px dashed #64748b",
          background: "#111827",
          overflow: "visible",
        }}
      >
        <canvas
          ref={canvasRef}
          width={drawSize}
          height={drawSize}
          style={{
            position: "absolute",
            top: -drawOverflowPx,
            left: -drawOverflowPx,
            width: drawSize,
            height: drawSize,
            imageRendering: "pixelated",
            transform: `translate(${designOffsetX}px, ${designOffsetY}px) scale(${designScale})`,
            transformOrigin: "center center",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: insetPx,
            left: insetPx,
            width: safeSize,
            height: safeSize,
            borderRadius: 8,
            border: "2px solid #60a5fa",
            background: "rgba(96, 165, 250, 0.12)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: insetPx + 8,
            left: insetPx + 8,
            right: insetPx + 8,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            pointerEvents: "none",
          }}
        >
          <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.45)" }} />
          <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.36)" }} />
          <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.28)" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Edit target type ───────────────────────────── */
type EditTarget =
  | { type: "tile"; key: keyof NineSliceTiles }
  | { type: "buttonBg"; btn: keyof SidePageTheme["buttons"]; key: keyof NineSliceTiles }
  | { type: "buttonIcon"; btn: keyof SidePageTheme["buttons"] }
  | { type: "themeIcon" };

const SLICE_LABELS: { id: keyof SidePageTheme["tiles"]; label: string }[] = [
  { id: "topLeft", label: "Top Left" },
  { id: "top", label: "Top" },
  { id: "topRight", label: "Top Right" },
  { id: "left", label: "Left" },
  { id: "center", label: "Center" },
  { id: "right", label: "Right" },
  { id: "bottomLeft", label: "Bot Left" },
  { id: "bottom", label: "Bottom" },
  { id: "bottomRight", label: "Bot Right" },
];

/* ── Main Page ──────────────────────────────────── */
export default function SidepageEditorPage() {
  const [themes, setThemes] = useState<SidePageTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  // Tileset source state (same pattern as object-editor)
  const [tilesetSrc, setTilesetSrc] = useState("");
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current editing target
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  // Multi-tile size for current slot
  const [editWidthTiles, setEditWidthTiles] = useState(1);
  const [editHeightTiles, setEditHeightTiles] = useState(1);
  // Scale/zoom for current slot
  const [editScale, setEditScale] = useState(1);
  const { confirm } = useNotify();

  // Bootstrap: load from server, then auto-heal if server is missing data
  useEffect(() => {
    Promise.all([
      loadSettingFromServer("dev-sidepage-themes"),
      loadSettingFromServer("dev-custom-tileset-sources"),
    ]).then(([serverThemes, serverSrcs]) => {
      const loaded = loadThemes();
      let normalized = loaded;
      if (typeof window !== "undefined" && !localStorage.getItem(FREE_TIER_OK_MIGRATION_KEY)) {
        normalized = loaded.map((t) => ({ ...t, freeTierOk: true }));
        saveThemes(normalized);
        localStorage.setItem(FREE_TIER_OK_MIGRATION_KEY, "1");
      }
      setThemes(normalized);
      if (normalized.length > 0) setSelectedThemeId(normalized[0]!.id);

      const persisted = loadCustomSources();
      setCustomSources(persisted);

      const builtIn = getUniqueTilesetSources();
      setTilesetSrc(builtIn[0] ?? "");

      autoHealSettings([["dev-sidepage-themes", serverThemes], ["dev-custom-tileset-sources", serverSrcs]]);
    });
  }, []);

  const tilesetSources = [...new Set([...getUniqueTilesetSources(), ...customSources])];

  // Helper: select an edit target and sync widthTiles/heightTiles/scale from its current sprite ref
  const selectEditTarget = useCallback((target: EditTarget) => {
    setEditTarget(target);
    const t = themes.find((th) => th.id === selectedThemeId);
    if (!t) return;
    let sp: ThemeSpriteRef | undefined;
    if (target.type === "tile") {
      sp = t.tiles[target.key];
    } else if (target.type === "buttonBg") {
      sp = t.buttons[target.btn]?.bg?.[target.key];
    } else if (target.type === "buttonIcon") {
      sp = t.buttons[target.btn]?.icon;
    } else {
      sp = typeof t.icon === "string" ? undefined : t.icon;
    }
    setEditWidthTiles(sp?.widthTiles ?? 1);
    setEditHeightTiles(sp?.heightTiles ?? 1);
    setEditScale(sp?.scale ?? 1);
  }, [themes, selectedThemeId]);

  const addCustomSource = useCallback((url: string) => {
    setCustomSources((prev) => {
      const next = [...new Set([...prev, url])];
      saveCustomSources(next);
      return next;
    });
    setTilesetSrc(url);
  }, []);

  const handleUploadTexture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadStatus("Uploading…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tiles/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        addCustomSource(data.url);
        setUploadStatus(`Uploaded: ${data.filename}`);
        return;
      }
    } catch { /* API unavailable */ }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      addCustomSource(dataUrl);
      setUploadStatus(`Loaded: ${file.name}`);
    };
    reader.onerror = () => setUploadStatus("Failed to read file");
    reader.readAsDataURL(file);
  }, [addCustomSource]);

  // Theme CRUD
  const handleCreateTheme = () => {
    const newTheme: SidePageTheme = {
      id: `theme-${Date.now()}`,
      name: "New Theme",
      isDefault: false,
      freeTierOk: true,
      visualOverflowPx: 0,
      designScale: 1,
      designOffsetXPx: 0,
      designOffsetYPx: 0,
      tiles: {},
      buttons: { link: {}, settings: {}, theme: {} },
    };
    const updated = [...themes, newTheme];
    setThemes(updated);
    saveThemes(updated);
    setSelectedThemeId(newTheme.id);
  };

  const handleDeleteTheme = (id: string) => {
    const theme = themes.find((t) => t.id === id);
    confirm(
      `Delete theme "${theme?.name || id}"? This cannot be undone.`,
      () => {
        const updated = themes.filter((t) => t.id !== id);
        setThemes(updated);
        saveThemes(updated);
        if (selectedThemeId === id) setSelectedThemeId(updated[0]?.id ?? null);
      },
      { title: "Delete Theme", confirmText: "Delete", cancelText: "Cancel" },
    );
  };

  const updateTheme = (updates: Partial<SidePageTheme>) => {
    const updated = themes.map((t) => (t.id === selectedThemeId ? { ...t, ...updates } : t));
    setThemes(updated);
    saveThemes(updated);
  };

  const setAsDefault = (id: string) => {
    const updated = themes.map((t) => ({ ...t, isDefault: t.id === id }));
    setThemes(updated);
    saveThemes(updated);
  };

  // Handle tile pick from grid
  const handlePickTile = useCallback((x: number, y: number) => {
    const theme = themes.find((t) => t.id === selectedThemeId);
    if (!theme || !editTarget || !tilesetSrc) return;

    const ref: ThemeSpriteRef = {
      src: tilesetSrc, x, y,
      ...(editWidthTiles > 1 ? { widthTiles: editWidthTiles } : {}),
      ...(editHeightTiles > 1 ? { heightTiles: editHeightTiles } : {}),
      ...(editScale !== 1 ? { scale: editScale } : {}),
    };

    if (editTarget.type === "tile") {
      updateTheme({ tiles: { ...theme.tiles, [editTarget.key]: ref } });
    } else if (editTarget.type === "buttonBg") {
      const btnData = theme.buttons[editTarget.btn] ?? {};
      updateTheme({
        buttons: {
          ...theme.buttons,
          [editTarget.btn]: { ...btnData, bg: { ...btnData.bg, [editTarget.key]: ref } },
        },
      });
    } else if (editTarget.type === "buttonIcon") {
      updateTheme({
        buttons: {
          ...theme.buttons,
          [editTarget.btn]: { ...(theme.buttons[editTarget.btn] ?? {}), icon: ref },
        },
      });
    } else {
      updateTheme({ icon: ref });
    }
  }, [themes, selectedThemeId, editTarget, tilesetSrc, editWidthTiles, editHeightTiles, editScale]);

  // Helper: apply a sprite ref update to current edit target
  const applyRefToTarget = (updated: ThemeSpriteRef) => {
    if (!editTarget || !selectedTheme) return;
    if (editTarget.type === "tile") {
      updateTheme({ tiles: { ...selectedTheme.tiles, [editTarget.key]: updated } });
    } else if (editTarget.type === "buttonBg") {
      const btnData = selectedTheme.buttons[editTarget.btn] ?? {};
      updateTheme({
        buttons: {
          ...selectedTheme.buttons,
          [editTarget.btn]: { ...btnData, bg: { ...btnData.bg, [editTarget.key]: updated } },
        },
      });
    } else if (editTarget.type === "buttonIcon") {
      updateTheme({
        buttons: {
          ...selectedTheme.buttons,
          [editTarget.btn]: { ...(selectedTheme.buttons[editTarget.btn] ?? {}), icon: updated },
        },
      });
    } else {
      updateTheme({ icon: updated });
    }
  };

  // Helper: clear current edit target slot
  const clearTarget = () => {
    if (!editTarget || !selectedTheme) return;
    if (editTarget.type === "tile") {
      const tiles = { ...selectedTheme.tiles };
      delete tiles[editTarget.key];
      updateTheme({ tiles });
    } else if (editTarget.type === "buttonBg") {
      const btnData = selectedTheme.buttons[editTarget.btn] ?? {};
      const bg = { ...btnData.bg };
      delete bg[editTarget.key];
      updateTheme({
        buttons: {
          ...selectedTheme.buttons,
          [editTarget.btn]: { ...btnData, bg },
        },
      });
    } else if (editTarget.type === "buttonIcon") {
      updateTheme({
        buttons: {
          ...selectedTheme.buttons,
          [editTarget.btn]: { ...(selectedTheme.buttons[editTarget.btn] ?? {}), icon: undefined },
        },
      });
    } else {
      updateTheme({ icon: undefined });
    }
  };

  const selectedTheme = themes.find((t) => t.id === selectedThemeId);
  const previewOverflowPx = Math.max(0, Math.min(80, selectedTheme?.visualOverflowPx ?? 0));
  const previewDesignScale = Math.max(0.8, Math.min(2, selectedTheme?.designScale ?? 1));
  const previewDesignOffsetX = Math.max(-80, Math.min(80, selectedTheme?.designOffsetXPx ?? 0));
  const previewDesignOffsetY = Math.max(-80, Math.min(80, selectedTheme?.designOffsetYPx ?? 0));
  const previewOuterSize = 150;

  const copyMainFrameToAllButtonBackgrounds = () => {
    if (!selectedTheme) return;
    updateTheme({
      buttons: {
        ...selectedTheme.buttons,
        link: { ...(selectedTheme.buttons.link ?? {}), bg: undefined, inheritMainFrameBg: true },
        settings: { ...(selectedTheme.buttons.settings ?? {}), bg: undefined, inheritMainFrameBg: true },
        theme: { ...(selectedTheme.buttons.theme ?? {}), bg: undefined, inheritMainFrameBg: true },
      },
    });
  };

  // Current sprite ref (for highlighting on the grid)
  const currentSpriteRef: ThemeSpriteRef | undefined = selectedTheme && editTarget
    ? editTarget.type === "tile"
      ? selectedTheme.tiles[editTarget.key]
      : editTarget.type === "buttonBg"
        ? selectedTheme.buttons[editTarget.btn]?.bg?.[editTarget.key]
        : editTarget.type === "buttonIcon"
          ? selectedTheme.buttons[editTarget.btn]?.icon
          : (typeof selectedTheme.icon === "string" ? undefined : selectedTheme.icon)
    : undefined;

  // Grid highlight coords — only highlight if looking at the same tileset
  const highlightX = currentSpriteRef?.src === tilesetSrc ? currentSpriteRef.x : -1;
  const highlightY = currentSpriteRef?.src === tilesetSrc ? currentSpriteRef.y : -1;

  return (
    <div style={{
      minHeight: "100vh", background: "#111118", color: "#e0e0e0",
      padding: "24px 28px", fontFamily: "system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>Sidepage Theme Editor</h1>
          <p style={{ color: "#666", margin: 0, fontSize: 13 }}>9-slice frames &amp; button sprites for the side panel.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a href="/dev/world-editor" style={{
            ...btnStyle, background: "#2a2a3e", color: "#aaa", textDecoration: "none",
          }}>← Back</a>
          <button onClick={handleCreateTheme} style={{ ...btnStyle, background: "#3b82f6", color: "#fff" }}>
            + New Theme
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 320px 1fr", gap: 16, height: "calc(100vh - 120px)" }}>

        {/* ─── Column 1: Theme list ─────────────── */}
        <div style={{ ...cardStyle, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Themes</div>
          {themes.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedThemeId(t.id)}
              style={{
                padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                background: t.id === selectedThemeId ? "#2a2a4e" : "transparent",
                border: `1px solid ${t.id === selectedThemeId ? "#3b82f6" : "transparent"}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 8,
              }}
            >
              {t.icon && typeof t.icon !== "string" ? (
                <SpritePreview spriteRef={t.icon} size={28} />
              ) : t.icon ? (
                <img src={t.icon} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 6, flexShrink: 0, imageRendering: "pixelated" }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: 6, background: "#333", flexShrink: 0 }} />
              )}
              <span style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
              {t.isDefault && (
                <span style={{ fontSize: 9, background: "#22c55e", color: "#fff", padding: "2px 5px", borderRadius: 4 }}>
                  DEFAULT
                </span>
              )}
            </div>
          ))}
        </div>

        {/* ─── Column 2: Theme editor form ──────── */}
        <div style={{ ...cardStyle, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {selectedTheme ? (
            <>
              {/* Name */}
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Theme Name</label>
                <input
                  style={inputStyle}
                  value={selectedTheme.name}
                  onChange={(e) => updateTheme({ name: e.target.value })}
                />
              </div>

              {/* Free Tier OK */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={selectedTheme.freeTierOk ?? true}
                  onChange={(e) => updateTheme({ freeTierOk: e.target.checked })}
                  style={{ accentColor: "#22c55e", width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>Free Tier OK</span>
                <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>Available for free-tier users</span>
              </label>

              {/* Theme Icon / Thumbnail */}
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Theme Icon</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    onClick={() => selectEditTarget({ type: "themeIcon" })}
                    style={{
                      display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4,
                      background: editTarget?.type === "themeIcon" ? "#3b82f633" : "#222",
                      border: `1.5px solid ${editTarget?.type === "themeIcon" ? "#3b82f6" : "#333"}`,
                      borderRadius: 6, padding: 6, cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <SpritePreview spriteRef={typeof selectedTheme.icon === "string" ? undefined : selectedTheme.icon} size={48} />
                    <span style={{ fontSize: 9, color: "#888" }}>Pick from tileset</span>
                  </div>
                  <button
                    onClick={() => updateTheme({ icon: undefined })}
                    style={{ ...btnStyle, background: "#ef444433", color: "#f87171", fontSize: 10, padding: "4px 10px" }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Panel Layout */}
              <div style={{ borderTop: "1px solid #333", paddingTop: 10 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600 }}>Design Overlay</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Design Scale</label>
                    <input
                      style={inputStyle}
                      type="number"
                      min={0.8}
                      max={2}
                      step={0.01}
                      value={previewDesignScale}
                      onChange={(e) => {
                        const v = Math.max(0.8, Math.min(2, parseFloat(e.target.value) || 1));
                        updateTheme({ designScale: Number(v.toFixed(2)) });
                      }}
                    />
                    <input
                      type="range"
                      min={0.8}
                      max={2}
                      step={0.01}
                      value={previewDesignScale}
                      onChange={(e) => updateTheme({ designScale: parseFloat(e.target.value) || 1 })}
                      style={{ width: "100%", marginTop: 5, accentColor: "#60a5fa" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Visual Overflow (px)</label>
                    <input
                      style={inputStyle}
                      type="number"
                      min={0}
                      max={80}
                      value={previewOverflowPx}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(80, parseInt(e.target.value, 10) || 0));
                        updateTheme({ visualOverflowPx: v });
                      }}
                    />
                    <input
                      type="range"
                      min={0}
                      max={80}
                      step={1}
                      value={previewOverflowPx}
                      onChange={(e) => updateTheme({ visualOverflowPx: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: "100%", marginTop: 5, accentColor: "#a78bfa" }}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Offset X (px)</label>
                    <input
                      style={inputStyle}
                      type="number"
                      min={-80}
                      max={80}
                      value={previewDesignOffsetX}
                      onChange={(e) => {
                        const v = Math.max(-80, Math.min(80, parseInt(e.target.value, 10) || 0));
                        updateTheme({ designOffsetXPx: v });
                      }}
                    />
                    <input
                      type="range"
                      min={-80}
                      max={80}
                      step={1}
                      value={previewDesignOffsetX}
                      onChange={(e) => updateTheme({ designOffsetXPx: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: "100%", marginTop: 5, accentColor: "#34d399" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#666" }}>Offset Y (px)</label>
                    <input
                      style={inputStyle}
                      type="number"
                      min={-80}
                      max={80}
                      value={previewDesignOffsetY}
                      onChange={(e) => {
                        const v = Math.max(-80, Math.min(80, parseInt(e.target.value, 10) || 0));
                        updateTheme({ designOffsetYPx: v });
                      }}
                    />
                    <input
                      type="range"
                      min={-80}
                      max={80}
                      step={1}
                      value={previewDesignOffsetY}
                      onChange={(e) => updateTheme({ designOffsetYPx: parseInt(e.target.value, 10) || 0 })}
                      style={{ width: "100%", marginTop: 5, accentColor: "#f59e0b" }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#777", marginTop: 5 }}>
                  These controls only move/scale frame art. Content area stays fixed.
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: "#9aa3b2" }}>
                  <span>Scale: <strong style={{ color: "#dbeafe" }}>{previewDesignScale.toFixed(2)}x</strong></span>
                  <span>Offset: <strong style={{ color: "#86efac" }}>{previewDesignOffsetX}px, {previewDesignOffsetY}px</strong></span>
                  <span>Current overflow: <strong style={{ color: "#e9d5ff" }}>{previewOverflowPx}px</strong></span>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    border: "1px solid #334155",
                    borderRadius: 8,
                    background: "#111827",
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 8 }}>Live Layout Preview</div>
                  <ThemeLayoutPreview
                    theme={selectedTheme}
                    overflowPx={previewOverflowPx}
                    designScale={previewDesignScale}
                    designOffsetX={previewDesignOffsetX}
                    designOffsetY={previewDesignOffsetY}
                    size={previewOuterSize}
                  />
                  <div style={{ marginTop: 8, fontSize: 9, color: "#8fa0b9", display: "flex", gap: 12, justifyContent: "center" }}>
                    <span>Dashed: panel edge</span>
                    <span>Blue: safe content area</span>
                    <span>Frame art: your selected sprites</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                {!selectedTheme.isDefault && (
                  <button
                    onClick={() => setAsDefault(selectedTheme.id)}
                    style={{ ...btnStyle, background: "#22c55e", color: "#fff", fontSize: 11, padding: "6px 12px", flex: 1 }}
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleDeleteTheme(selectedTheme.id)}
                  style={{ ...btnStyle, background: "#ef4444", color: "#fff", fontSize: 11, padding: "6px 12px" }}
                >
                  Delete
                </button>
              </div>

              {/* 9-Slice */}
              <details open style={{ borderTop: "1px solid #333", paddingTop: 12 }}>
                <summary style={{ fontSize: 12, color: "#888", marginBottom: 8, cursor: "pointer", fontWeight: 600 }}>
                  9-Slice Frame Tiles
                </summary>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  {SLICE_LABELS.map(({ id, label }) => {
                    const isActive = editTarget?.type === "tile" && editTarget.key === id;
                    const sp = selectedTheme.tiles[id];
                    return (
                      <div
                        key={id}
                        onClick={() => selectEditTarget({ type: "tile", key: id })}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                          background: isActive ? "#3b82f633" : "#222",
                          border: `1.5px solid ${isActive ? "#3b82f6" : "#333"}`,
                          borderRadius: 6, padding: 6, cursor: "pointer",
                          transition: "border-color 0.15s",
                        }}
                      >
                        <SpritePreview spriteRef={sp} size={40} />
                        <span style={{ fontSize: 9, color: "#888" }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </details>

              {/* Buttons */}
              <details style={{ borderTop: "1px solid #333", paddingTop: 12 }}>
                <summary style={{ fontSize: 12, color: "#888", marginBottom: 8, cursor: "pointer", fontWeight: 600 }}>
                  Button Sprites
                </summary>
                <div style={{ marginBottom: 10 }}>
                  <button
                    onClick={copyMainFrameToAllButtonBackgrounds}
                    style={{
                      border: "1px solid #3b82f6",
                      background: "#1e3a8a",
                      color: "#dbeafe",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    title="Copy current main 9-slice frame tiles to all button backgrounds"
                  >
                    Copy Main 9-Slice to All Button BGs
                  </button>
                  <div style={{ marginTop: 5, fontSize: 10, color: "#777" }}>
                    Uses inherited main frame tiles (compact mode, avoids large saves).
                  </div>
                </div>
                {(["link", "settings", "theme"] as const).map((btnKey) => {
                  const isGroupActive =
                    (editTarget?.type === "buttonBg" && editTarget.btn === btnKey) ||
                    (editTarget?.type === "buttonIcon" && editTarget.btn === btnKey);

                  return (
                    <details key={btnKey} open={isGroupActive} style={{ marginBottom: 14 }}>
                      <summary style={{ fontSize: 11, color: "#666", textTransform: "capitalize", marginBottom: 6, cursor: "pointer", fontWeight: 600 }}>
                        {btnKey}
                      </summary>

                      {/* 9-slice bg grid */}
                      <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Background (9-slice)</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 8 }}>
                        {SLICE_LABELS.map(({ id, label }) => {
                          const isActive = editTarget?.type === "buttonBg" && editTarget.btn === btnKey && editTarget.key === id;
                          const btnCfg = selectedTheme.buttons[btnKey];
                          const sp = btnCfg?.bg?.[id] ?? (btnCfg?.inheritMainFrameBg ? selectedTheme.tiles[id] : undefined);
                          return (
                            <div
                              key={id}
                              onClick={() => selectEditTarget({ type: "buttonBg", btn: btnKey, key: id })}
                              style={{
                                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                                background: isActive ? "#3b82f633" : "#222",
                                border: `1.5px solid ${isActive ? "#3b82f6" : "#333"}`,
                                borderRadius: 4, padding: 4, cursor: "pointer",
                                transition: "border-color 0.15s",
                              }}
                            >
                              <SpritePreview spriteRef={sp} size={28} />
                              <span style={{ fontSize: 8, color: "#888" }}>{label}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Icon (single sprite) */}
                      <div style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>Icon</div>
                      <div
                        onClick={() => selectEditTarget({ type: "buttonIcon", btn: btnKey })}
                        style={{
                          display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4,
                          background: editTarget?.type === "buttonIcon" && editTarget.btn === btnKey ? "#3b82f633" : "#222",
                          border: `1.5px solid ${editTarget?.type === "buttonIcon" && editTarget.btn === btnKey ? "#3b82f6" : "#333"}`,
                          borderRadius: 6, padding: 6, cursor: "pointer",
                          transition: "border-color 0.15s",
                        }}
                      >
                        <SpritePreview spriteRef={selectedTheme.buttons[btnKey]?.icon} size={40} />
                        <span style={{ fontSize: 9, color: "#888" }}>Icon</span>
                      </div>
                    </details>
                  );
                })}
              </details>

              {/* Current selection info + fine-tune controls */}
              {editTarget && (
                <details open style={{
                  background: "#3b82f611", border: "1px solid #3b82f644",
                  borderRadius: 8, padding: "8px 12px", fontSize: 12,
                }}>
                  <summary style={{ color: "#93c5fd", cursor: "pointer", marginBottom: 6 }}>
                    Editing: <strong>
                      {editTarget.type === "tile"
                        ? editTarget.key
                        : editTarget.type === "buttonBg"
                          ? `${editTarget.btn} bg → ${editTarget.key}`
                          : editTarget.type === "buttonIcon"
                            ? `${editTarget.btn} → icon`
                            : "theme icon"}
                    </strong>
                  </summary>
                  {currentSpriteRef && (
                    <div style={{ color: "#666", marginTop: 2, fontSize: 11 }}>
                      {currentSpriteRef.src.split("/").pop()} @ ({currentSpriteRef.x}, {currentSpriteRef.y})
                      {((currentSpriteRef.widthTiles ?? 1) > 1 || (currentSpriteRef.heightTiles ?? 1) > 1) && (
                        <> — {currentSpriteRef.widthTiles ?? 1}×{currentSpriteRef.heightTiles ?? 1} tiles</>
                      )}
                    </div>
                  )}

                  {/* Multi-tile size controls */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#666" }}>W tiles</label>
                      <input style={inputStyle} type="number" min={1} max={8} value={editWidthTiles}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(8, parseInt(e.target.value, 10) || 1));
                          setEditWidthTiles(v);
                          if (currentSpriteRef) {
                            const updated: ThemeSpriteRef = { ...currentSpriteRef, widthTiles: v > 1 ? v : undefined };
                            applyRefToTarget(updated);
                          }
                        }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#666" }}>H tiles</label>
                      <input style={inputStyle} type="number" min={1} max={8} value={editHeightTiles}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(8, parseInt(e.target.value, 10) || 1));
                          setEditHeightTiles(v);
                          if (currentSpriteRef) {
                            const updated: ThemeSpriteRef = { ...currentSpriteRef, heightTiles: v > 1 ? v : undefined };
                            applyRefToTarget(updated);
                          }
                        }} />
                    </div>
                  </div>

                  {/* Fine-tune scale / zoom */}
                  <div>
                    <label style={{ fontSize: 10, color: "#666", display: "block", marginBottom: 4 }}>Zoom scale</label>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input style={{ ...inputStyle, flex: 1 }} type="range" min={0.25} max={4} step={0.25} value={editScale}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setEditScale(v);
                          if (currentSpriteRef) {
                            const updated: ThemeSpriteRef = { ...currentSpriteRef, scale: v !== 1 ? v : undefined };
                            applyRefToTarget(updated);
                          }
                        }} />
                      <span style={{ fontSize: 11, color: "#888", minWidth: "32px", textAlign: "right" }}>{editScale.toFixed(2)}x</span>
                    </div>
                  </div>

                  {/* Fine-tune position */}
                  <details style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", marginBottom: 4 }}>Fine-tune position (px)</summary>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: "#666" }}>srcX</label>
                        <input style={inputStyle} type="number" min={0}
                          value={currentSpriteRef?.x ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            if (!currentSpriteRef) return;
                            applyRefToTarget({ ...currentSpriteRef, x: val });
                          }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#666" }}>srcY</label>
                        <input style={inputStyle} type="number" min={0}
                          value={currentSpriteRef?.y ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            if (!currentSpriteRef) return;
                            applyRefToTarget({ ...currentSpriteRef, y: val });
                          }} />
                      </div>
                    </div>
                  </details>

                  {/* Clear slot */}
                  {currentSpriteRef && (
                    <button
                      onClick={clearTarget}
                      style={{ ...btnStyle, background: "#ef444433", color: "#f87171", fontSize: 11, padding: "4px 10px", marginTop: 8, width: "100%" }}
                    >
                      Clear this slot
                    </button>
                  )}
                </details>
              )}
            </>
          ) : (
            <div style={{ color: "#666", padding: 20, textAlign: "center" }}>
              Select or create a theme to begin editing.
            </div>
          )}
        </div>

        {/* ─── Column 3: Tileset picker ─────────── */}
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Tileset source selector */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Tileset Source</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={tilesetSrc}
              onChange={(e) => setTilesetSrc(e.target.value)}
            >
              <option value="">— choose —</option>
              {tilesetSources.map((src) => (
                <option key={src} value={src}>{src.split("/").pop()}</option>
              ))}
            </select>
            <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                onChange={handleUploadTexture}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ ...btnStyle, background: "#2a2a3e", color: "#aaa", fontSize: 11, padding: "5px 12px" }}
              >
                Upload PNG…
              </button>
              {uploadStatus && <span style={{ fontSize: 11, color: "#888" }}>{uploadStatus}</span>}
            </div>
          </div>

          {/* Status banner */}
          {editTarget ? (
            <div style={{
              padding: "6px 10px", background: "#3b82f622", border: "1px solid #3b82f644",
              borderRadius: 6, marginBottom: 10, color: "#93c5fd", fontSize: 12,
            }}>
              Click a tile below to assign it to <strong>
                {editTarget.type === "tile"
                  ? editTarget.key
                  : editTarget.type === "buttonBg"
                    ? `${editTarget.btn} bg → ${editTarget.key}`
                    : editTarget.type === "buttonIcon"
                      ? `${editTarget.btn} icon`
                      : "theme icon"}
              </strong>
            </div>
          ) : (
            <div style={{
              padding: "6px 10px", background: "#222", borderRadius: 6,
              marginBottom: 10, color: "#666", fontSize: 12,
            }}>
              Select a slot from the editor panel first, then pick a tile here.
            </div>
          )}

          {/* The actual tileset grid picker */}
          <div style={{
            flex: 1, overflow: "auto", background: "#0a0a0a",
            borderRadius: 6, border: "1px solid #333",
          }}>
            <TilesetGridPicker
              src={tilesetSrc}
              srcX={highlightX >= 0 ? highlightX : 0}
              srcY={highlightY >= 0 ? highlightY : 0}
              widthTiles={editWidthTiles}
              heightTiles={editHeightTiles}
              onSelect={handlePickTile}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
