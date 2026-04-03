"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  TILE_REGISTRY,
  TILESET_TILE_SIZE,
  getDefaultAutoTileMap,
  setCustomAutoTileMap,
  clearCustomAutoTileMap,
  setCustomLinearMap,
  clearCustomLinearMap,
  getLinearAutoTileMap,
  DEFAULT_LINEAR_MAP,
  LINEAR_STATE_LABELS,
  initDevTiles,
  getAllTiles,
} from "@mypixelpage/shared";
import type { BitmaskMapEntry, TileDef } from "@mypixelpage/shared";
import { syncSettingToServer, loadSettingFromServer, autoHealSettings } from "@/lib/utils/dev-settings-sync";

/* ── Constants ──────────────────────────────────────── */

const CARDINAL_STORAGE_KEY = "autotile-custom-maps";
const QUADRANT_STORAGE_KEY = "autotile-quadrant-maps";
const VARIANTS_STORAGE_KEY = "autotile-center-variants";
const LINEAR_STORAGE_KEY = "autotile-linear-maps";
const SCALE = 3;
const CELL_PX = TILESET_TILE_SIZE * SCALE;

function getAutoTilesFromAll(): TileDef[] {
  return getAllTiles().filter((t) => t.autoTile && t.tilesetSrc);
}
function getOverlayTilesFromAll(): TileDef[] {
  return getAllTiles().filter((t) => t.overlaySrc);
}

const BITMASK_LABELS = [
  "Isolated", "N", "E", "N+E", "S", "N+S", "E+S", "N+E+S",
  "W", "N+W", "E+W", "N+E+W", "S+W", "N+S+W", "E+S+W", "All",
];

/* ── Quadrant definitions ─────────────────────────── */

const QUADRANT_NAMES = ["TL", "TR", "BL", "BR"] as const;
const STATE_NAMES = ["Outer Corner", "Vert Edge", "Horiz Edge", "Center Fill", "Inner Corner"] as const;
const STATE_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#22c55e", "#c084fc"];

/** Default quadrant source coords from TERRAIN_QUAD_SRC in tiles.ts */
const DEFAULT_QUAD_MAP: { col: number; row: number }[][] = [
  // TL
  [{ col: 0, row: 0 }, { col: 0, row: 1 }, { col: 1, row: 0 }, { col: 1, row: 1 }, { col: 6, row: 2 }],
  // TR
  [{ col: 2, row: 0 }, { col: 2, row: 1 }, { col: 1, row: 0 }, { col: 1, row: 1 }, { col: 5, row: 2 }],
  // BL
  [{ col: 0, row: 2 }, { col: 0, row: 1 }, { col: 1, row: 2 }, { col: 1, row: 1 }, { col: 6, row: 1 }],
  // BR
  [{ col: 2, row: 2 }, { col: 2, row: 1 }, { col: 1, row: 2 }, { col: 1, row: 1 }, { col: 5, row: 1 }],
];

interface CenterVariant {
  col: number;
  row: number;
  weight: number; // percentage 1-100
}

/* ── Persistence ────────────────────────────────────── */

function loadCardinalMaps(): Record<string, BitmaskMapEntry[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CARDINAL_STORAGE_KEY) ?? "{}");
  } catch { return {}; }
}

function saveCardinalMaps(maps: Record<string, BitmaskMapEntry[]>) {
  localStorage.setItem(CARDINAL_STORAGE_KEY, JSON.stringify(maps));
  syncSettingToServer(CARDINAL_STORAGE_KEY, JSON.stringify(maps));
  for (const [src, map] of Object.entries(maps)) {
    setCustomAutoTileMap(src, map);
  }
}

function loadQuadrantMaps(): Record<string, { col: number; row: number }[][]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(QUADRANT_STORAGE_KEY) ?? "{}");
  } catch { return {}; }
}

function saveQuadrantMaps(maps: Record<string, { col: number; row: number }[][]>) {
  localStorage.setItem(QUADRANT_STORAGE_KEY, JSON.stringify(maps));
  syncSettingToServer(QUADRANT_STORAGE_KEY, JSON.stringify(maps));
}

function loadCenterVariants(): Record<string, CenterVariant[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(VARIANTS_STORAGE_KEY) ?? "{}");
  } catch { return {}; }
}

function saveCenterVariants(variants: Record<string, CenterVariant[]>) {
  localStorage.setItem(VARIANTS_STORAGE_KEY, JSON.stringify(variants));
  syncSettingToServer(VARIANTS_STORAGE_KEY, JSON.stringify(variants));
}

function loadLinearMaps(): Record<string, BitmaskMapEntry[]> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LINEAR_STORAGE_KEY) ?? "{}");
  } catch { return {}; }
}

function saveLinearMaps(maps: Record<string, BitmaskMapEntry[]>) {
  localStorage.setItem(LINEAR_STORAGE_KEY, JSON.stringify(maps));
  syncSettingToServer(LINEAR_STORAGE_KEY, JSON.stringify(maps));
  for (const [src, map] of Object.entries(maps)) {
    setCustomLinearMap(src, map);
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

const inputStyle: React.CSSProperties = {
  backgroundColor: "#2a2a3e",
  border: "1px solid #444",
  borderRadius: 6,
  padding: "4px 8px",
  color: "#e0e0e0",
  fontSize: 12,
  width: "100%",
};

/* ── Small helpers ──────────────────────────────────── */

function NeighborDiagram({ mask }: { mask: number }) {
  const N = 1, E = 2, S = 4, W = 8;
  const cells = [
    [false, !!(mask & N), false],
    [!!(mask & W), true, !!(mask & E)],
    [false, !!(mask & S), false],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 12px)", gap: 1 }}>
      {cells.flat().map((on, i) => (
        <div
          key={i}
          style={{
            width: 12, height: 12, borderRadius: 2,
            background: i === 4 ? "#ffdd00" : on ? "#4a7c59" : "#2a2a3e",
            border: "1px solid #444",
          }}
        />
      ))}
    </div>
  );
}

function TilePreviewCanvas({ src, col, row, size = 40 }: { src: string; col: number; row: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, col * TILESET_TILE_SIZE, row * TILESET_TILE_SIZE, TILESET_TILE_SIZE, TILESET_TILE_SIZE, 0, 0, size, size);
    };
    img.src = src;
  }, [src, col, row, size]);
  return <canvas ref={ref} width={size} height={size} style={{ borderRadius: 3, imageRendering: "pixelated" }} />;
}

/* ── Tileset grid canvas with click-to-select ──────── */

function TilesetGrid({
  src,
  onCellClick,
  annotationMap,
}: {
  src: string;
  onCellClick: (col: number, row: number) => void;
  annotationMap?: Map<string, { color: string; label: string }>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  const gridCols = img ? Math.floor(img.width / TILESET_TILE_SIZE) : 0;
  const gridRows = img ? Math.floor(img.height / TILESET_TILE_SIZE) : 0;

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !img) return;
    const w = img.width * SCALE;
    const h = img.height * SCALE;
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= gridCols; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL_PX, 0); ctx.lineTo(c * CELL_PX, h); ctx.stroke();
    }
    for (let r = 0; r <= gridRows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL_PX); ctx.lineTo(w, r * CELL_PX); ctx.stroke();
    }

    // Coordinates
    ctx.font = "9px monospace";
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillText(`${c},${r}`, c * CELL_PX + 2, r * CELL_PX + 9);
      }
    }

    // Annotation overlays
    if (annotationMap) {
      annotationMap.forEach((ann, key) => {
        const [cs, rs] = key.split(",");
        const c = parseInt(cs!, 10), r = parseInt(rs!, 10);
        ctx.fillStyle = ann.color + "33";
        ctx.fillRect(c * CELL_PX, r * CELL_PX, CELL_PX, CELL_PX);
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(c * CELL_PX + 1, r * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
        ctx.fillStyle = ann.color;
        ctx.font = "bold 9px monospace";
        ctx.fillText(ann.label, c * CELL_PX + 2, r * CELL_PX + CELL_PX - 3);
      });
    }
  }, [img, annotationMap, gridCols, gridRows]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cvs = canvasRef.current;
    if (!cvs || !img) return;
    const rect = cvs.getBoundingClientRect();
    const sx = cvs.width / rect.width;
    const sy = cvs.height / rect.height;
    const col = Math.floor(((e.clientX - rect.left) * sx) / CELL_PX);
    const row = Math.floor(((e.clientY - rect.top) * sy) / CELL_PX);
    if (col >= 0 && col < gridCols && row >= 0 && row < gridRows) {
      onCellClick(col, row);
    }
  }, [img, gridCols, gridRows, onCellClick]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ cursor: "crosshair", maxWidth: "100%", borderRadius: 6, border: "1px solid #444", imageRendering: "pixelated" }}
    />
  );
}

/* ── Overlay preview ───────────────────────────────── */

function OverlayPreview({ name, baseSrc, overlaySrc }: { name: string; baseSrc: string; overlaySrc: string }) {
  const baseRef = useRef<HTMLCanvasElement>(null);
  const compositeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const baseImg = new Image();
    const overlayImg = new Image();
    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded < 2) return;
      const bCvs = baseRef.current;
      if (bCvs) {
        bCvs.width = baseImg.width * SCALE; bCvs.height = baseImg.height * SCALE;
        const ctx = bCvs.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(baseImg, 0, 0, bCvs.width, bCvs.height);
      }
      const cCvs = compositeRef.current;
      if (cCvs) {
        cCvs.width = baseImg.width * SCALE; cCvs.height = baseImg.height * SCALE;
        const ctx = cCvs.getContext("2d")!;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(baseImg, 0, 0, cCvs.width, cCvs.height);
        ctx.drawImage(overlayImg, 0, 0, cCvs.width, cCvs.height);
      }
    };
    baseImg.onload = onLoad; overlayImg.onload = onLoad;
    baseImg.src = baseSrc; overlayImg.src = overlaySrc;
  }, [baseSrc, overlaySrc]);

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#aaa" }}>{name} — Layers</h3>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>Base</div>
          <canvas ref={baseRef} style={{ maxWidth: 250, borderRadius: 4, border: "1px solid #444" }} />
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>Combined</div>
          <canvas ref={compositeRef} style={{ maxWidth: 250, borderRadius: 4, border: "1px solid #444" }} />
        </div>
      </div>
    </div>
  );
}

/* ── Tab type ──────────────────────────────────────── */

type TabId = "cardinal" | "quadrant" | "variants" | "linear";

/* ── Main page ─────────────────────────────────────── */

export default function AutoTileMappingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("quadrant");
  const [autoTiles, setAutoTiles] = useState<TileDef[]>([]);
  const [overlayTiles, setOverlayTiles] = useState<TileDef[]>([]);
  const [selectedTileset, setSelectedTileset] = useState("");

  // Cardinal (4-bit) state
  const [cardinalMaps, setCardinalMaps] = useState<Record<string, BitmaskMapEntry[]>>({});
  const [selectedCase, setSelectedCase] = useState<number | null>(null);

  // Quadrant (8-bit) state
  const [quadrantMaps, setQuadrantMaps] = useState<Record<string, { col: number; row: number }[][]>>({});
  const [selectedQuadrant, setSelectedQuadrant] = useState<number>(0);
  const [selectedState, setSelectedState] = useState<number>(0);

  // Center variants state
  const [centerVariants, setCenterVariants] = useState<Record<string, CenterVariant[]>>({});

  // Linear (bridge) state
  const [linearMaps, setLinearMaps] = useState<Record<string, BitmaskMapEntry[]>>({});
  const [selectedLinearState, setSelectedLinearState] = useState<number>(0);

  // Init — register dev tiles, then compute auto/overlay tile lists
  useEffect(() => {
    Promise.all([
      loadSettingFromServer("dev-tiles"),
      loadSettingFromServer("autotile-custom-maps"),
      loadSettingFromServer("autotile-quadrant-maps"),
      loadSettingFromServer("autotile-center-variants"),
      loadSettingFromServer("autotile-linear-maps"),
    ]).then(([serverTiles, serverCardinal, serverQuadrant, serverVariants, serverLinear]) => {
      initDevTiles();
      const at = getAutoTilesFromAll();
      setAutoTiles(at);
      setOverlayTiles(getOverlayTilesFromAll());
      if (at.length > 0) setSelectedTileset(at[0]!.tilesetSrc!);
      setCardinalMaps(loadCardinalMaps());
      setQuadrantMaps(loadQuadrantMaps());
      setCenterVariants(loadCenterVariants());
      setLinearMaps(loadLinearMaps());
      const cm = loadCardinalMaps();
      for (const [src, m] of Object.entries(cm)) setCustomAutoTileMap(src, m);
      const lm = loadLinearMaps();
      for (const [src, m] of Object.entries(lm)) setCustomLinearMap(src, m);
      autoHealSettings([
        ["dev-tiles", serverTiles],
        ["autotile-custom-maps", serverCardinal],
        ["autotile-quadrant-maps", serverQuadrant],
        ["autotile-center-variants", serverVariants],
        ["autotile-linear-maps", serverLinear],
      ]);
    });
  }, []);

  const tileDef = autoTiles.find((t) => t.tilesetSrc === selectedTileset);
  const tileMode = tileDef?.autoTileMode ?? "quadrant";
  const isLinear = tileMode === "linear";
  const isCardinal = tileMode === "cardinal";

  const defaultCardinalMap = getDefaultAutoTileMap(selectedTileset);
  const currentCardinalMap: BitmaskMapEntry[] = cardinalMaps[selectedTileset]
    ? [...cardinalMaps[selectedTileset]] : [...defaultCardinalMap];

  const currentLinearMap: BitmaskMapEntry[] = linearMaps[selectedTileset]
    ? [...linearMaps[selectedTileset]] : [...DEFAULT_LINEAR_MAP];

  const currentQuadMap = quadrantMaps[selectedTileset] ?? DEFAULT_QUAD_MAP;
  const currentVariants = centerVariants[selectedTileset] ?? [];

  // Build annotation map for quadrant mapping
  const quadAnnotations = React.useMemo(() => {
    const map = new Map<string, { color: string; label: string }>();
    if (!isCardinal && !isLinear) {
      for (let qi = 0; qi < 4; qi++) {
        for (let si = 0; si < 5; si++) {
          const cell = currentQuadMap[qi]?.[si];
          if (!cell) continue;
          const key = `${cell.col},${cell.row}`;
          const existing = map.get(key);
          const label = `${QUADRANT_NAMES[qi]}:${si}`;
          map.set(key, {
            color: STATE_COLORS[si]!,
            label: existing ? existing.label + " " + label : label,
          });
        }
      }
      for (const v of currentVariants) {
        const key = `${v.col},${v.row}`;
        map.set(key, { color: "#06b6d4", label: `V${v.weight}%` });
      }
    }
    return map;
  }, [currentQuadMap, currentVariants, isCardinal, isLinear]);

  // Build annotation map for cardinal mapping
  const cardinalAnnotations = React.useMemo(() => {
    const map = new Map<string, { color: string; label: string }>();
    if (isCardinal) {
      currentCardinalMap.forEach((entry, i) => {
        const key = `${entry.col},${entry.row}`;
        const existing = map.get(key);
        map.set(key, { color: "#4fc3f7", label: existing ? existing.label + ` ${i}` : `${i}` });
      });
    }
    return map;
  }, [currentCardinalMap, isCardinal]);

  // Build annotation map for linear mapping
  const linearAnnotations = React.useMemo(() => {
    const map = new Map<string, { color: string; label: string }>();
    if (isLinear) {
      currentLinearMap.forEach((entry, i) => {
        const key = `${entry.col},${entry.row}`;
        const existing = map.get(key);
        map.set(key, { color: "#f59e0b", label: existing ? existing.label + ` ${i}` : `${i}` });
      });
    }
    return map;
  }, [currentLinearMap, isLinear]);

  // ─── Cardinal handlers ───
  const handleCardinalAssign = useCallback((col: number, row: number) => {
    if (selectedCase === null) return;
    const newMap = [...currentCardinalMap];
    newMap[selectedCase] = { col, row };
    const newMaps = { ...cardinalMaps, [selectedTileset]: newMap };
    setCardinalMaps(newMaps);
    saveCardinalMaps(newMaps);
    setSelectedCase((sc) => (sc !== null && sc < 15 ? sc + 1 : sc));
  }, [selectedCase, currentCardinalMap, cardinalMaps, selectedTileset]);

  const handleCardinalReset = useCallback(() => {
    const newMaps = { ...cardinalMaps };
    delete newMaps[selectedTileset];
    setCardinalMaps(newMaps);
    saveCardinalMaps(newMaps);
    clearCustomAutoTileMap(selectedTileset);
  }, [cardinalMaps, selectedTileset]);

  // ─── Quadrant handlers ───
  const handleQuadrantAssign = useCallback((col: number, row: number) => {
    const newMap = currentQuadMap.map((q) => [...q]);
    newMap[selectedQuadrant]![selectedState] = { col, row };
    const newMaps = { ...quadrantMaps, [selectedTileset]: newMap };
    setQuadrantMaps(newMaps);
    saveQuadrantMaps(newMaps);
    // Auto-advance
    setSelectedState((s) => {
      if (s < 4) return s + 1;
      if (selectedQuadrant < 3) { setSelectedQuadrant((q) => q + 1); return 0; }
      return s;
    });
  }, [currentQuadMap, selectedQuadrant, selectedState, quadrantMaps, selectedTileset]);

  const handleQuadrantReset = useCallback(() => {
    const newMaps = { ...quadrantMaps };
    delete newMaps[selectedTileset];
    setQuadrantMaps(newMaps);
    saveQuadrantMaps(newMaps);
  }, [quadrantMaps, selectedTileset]);

  // ─── Variant handlers ───
  const handleAddVariant = useCallback((col: number, row: number) => {
    const newVariants = [...currentVariants, { col, row, weight: 10 }];
    const newAll = { ...centerVariants, [selectedTileset]: newVariants };
    setCenterVariants(newAll);
    saveCenterVariants(newAll);
  }, [currentVariants, centerVariants, selectedTileset]);

  const handleRemoveVariant = useCallback((idx: number) => {
    const newVariants = currentVariants.filter((_, i) => i !== idx);
    const newAll = { ...centerVariants, [selectedTileset]: newVariants };
    setCenterVariants(newAll);
    saveCenterVariants(newAll);
  }, [currentVariants, centerVariants, selectedTileset]);

  const handleVariantWeight = useCallback((idx: number, weight: number) => {
    const newVariants = currentVariants.map((v, i) => i === idx ? { ...v, weight } : v);
    const newAll = { ...centerVariants, [selectedTileset]: newVariants };
    setCenterVariants(newAll);
    saveCenterVariants(newAll);
  }, [currentVariants, centerVariants, selectedTileset]);

  // ─── Linear handlers ───
  const handleLinearAssign = useCallback((col: number, row: number) => {
    const newMap = [...currentLinearMap];
    newMap[selectedLinearState] = { col, row };
    const newMaps = { ...linearMaps, [selectedTileset]: newMap };
    setLinearMaps(newMaps);
    saveLinearMaps(newMaps);
    setSelectedLinearState((s) => (s < 7 ? s + 1 : s));
  }, [selectedLinearState, currentLinearMap, linearMaps, selectedTileset]);

  const handleLinearReset = useCallback(() => {
    const newMaps = { ...linearMaps };
    delete newMaps[selectedTileset];
    setLinearMaps(newMaps);
    saveLinearMaps(newMaps);
    clearCustomLinearMap(selectedTileset);
  }, [linearMaps, selectedTileset]);

  // Auto-select tab based on tileset type
  useEffect(() => {
    if (isLinear && activeTab !== "linear") setActiveTab("linear");
    if (isCardinal && activeTab !== "cardinal") setActiveTab("cardinal");
    if (!isCardinal && !isLinear && (activeTab === "cardinal" || activeTab === "linear")) setActiveTab("quadrant");
  }, [selectedTileset, isLinear, isCardinal, activeTab]);

  const tabs: { id: TabId; label: string; disabled: boolean }[] = [
    { id: "quadrant", label: "Quadrant Mapping (8-bit)", disabled: isCardinal || isLinear },
    { id: "cardinal", label: "Cardinal Mapping (4-bit)", disabled: isLinear },
    { id: "linear", label: "Linear Mapping (bridges)", disabled: !isLinear },
    { id: "variants", label: "Center Variants", disabled: isCardinal || isLinear },
  ];

  return (
    <div style={pageBg}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Auto-Tile Mapping Editor</h1>
          <p style={{ color: "#888", fontSize: 13, margin: "4px 0 0" }}>
            Map tileset cells to auto-tile roles. Terrain uses 8-bit quadrant system (inner corners, edges).
            Paths use 4-bit cardinal. Bridges use linear (no corners, with land detection).
            Configure random center variants for natural-looking fills.
          </p>
        </div>
        <a href="/dev/world-editor" style={{ ...btnStyle, background: "#333", color: "#ccc", textDecoration: "none", padding: "8px 16px" }}>
          ← Dev Tiles
        </a>
      </div>

      {/* Tileset selector */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#888" }}>Tileset:</span>
        {autoTiles.map((t) => (
          <button
            key={t.id}
            onClick={() => { setSelectedTileset(t.tilesetSrc!); setSelectedCase(null); }}
            style={{
              ...btnStyle,
              border: t.tilesetSrc === selectedTileset ? "2px solid #ffdd00" : "1px solid #444",
              background: t.tilesetSrc === selectedTileset ? "#2a2a4e" : "#1a1a2e",
              color: "#e0e0e0",
              fontWeight: t.tilesetSrc === selectedTileset ? 700 : 400,
            }}
          >
            {t.name} ({t.autoTileMode === "linear" ? "linear" : t.autoTileMode === "cardinal" ? "4-bit" : "8-bit"})
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #333", paddingBottom: 8 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveTab(tab.id)}
            style={{
              ...btnStyle,
              background: activeTab === tab.id ? "#2a2a4e" : "transparent",
              color: tab.disabled ? "#444" : activeTab === tab.id ? "#ffdd00" : "#888",
              borderBottom: activeTab === tab.id ? "2px solid #ffdd00" : "2px solid transparent",
              cursor: tab.disabled ? "not-allowed" : "pointer",
              opacity: tab.disabled ? 0.5 : 1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "start" }}>
        {/* LEFT: Tileset grid */}
        <div style={cardStyle}>
          <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#aaa" }}>
            {tileDef?.name} tileset
          </h3>
          <TilesetGrid
            src={selectedTileset}
            onCellClick={
              activeTab === "linear" ? handleLinearAssign
                : activeTab === "cardinal" ? handleCardinalAssign
                : activeTab === "quadrant" ? handleQuadrantAssign
                : handleAddVariant
            }
            annotationMap={
              activeTab === "linear" ? linearAnnotations
                : activeTab === "cardinal" ? cardinalAnnotations
                : quadAnnotations
            }
          />
          <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
            Click a cell to assign it to the selected role
          </div>
        </div>

        {/* RIGHT: Tab content */}
        <div>
          {/* ─── Quadrant tab ─── */}
          {activeTab === "quadrant" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 14, color: "#aaa" }}>
                    Quadrant Mapping — 5 states × 4 quadrants = 20 slots
                  </h3>
                  <button onClick={handleQuadrantReset} style={{ ...btnStyle, background: "#2a1a1a", color: "#d95c5c", border: "1px solid #d95c5c" }}>
                    Reset
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "#666", margin: "0 0 12px", lineHeight: 1.5 }}>
                  Each 16×16 tile is split into 4 quadrants (8×8). Each quadrant has 5 possible states
                  depending on neighboring tiles: outer corner, vertical edge, horizontal edge, center fill, and inner corner.
                  Select a quadrant + state, then click on the tileset to assign the source cell.
                </p>

                {/* Quadrant selector */}
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {QUADRANT_NAMES.map((name, qi) => (
                    <button
                      key={qi}
                      onClick={() => setSelectedQuadrant(qi)}
                      style={{
                        ...btnStyle,
                        flex: 1,
                        background: selectedQuadrant === qi ? "#2a2a4e" : "#16162a",
                        color: selectedQuadrant === qi ? "#ffdd00" : "#888",
                        border: selectedQuadrant === qi ? "2px solid #ffdd00" : "1px solid #333",
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                {/* State selector with previews */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {STATE_NAMES.map((stateName, si) => {
                    const cell = currentQuadMap[selectedQuadrant]?.[si];
                    const isSelected = selectedState === si;
                    return (
                      <div
                        key={si}
                        onClick={() => setSelectedState(si)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          background: isSelected ? "#2a2a4e" : "#16162a",
                          borderRadius: 8,
                          border: isSelected ? `2px solid ${STATE_COLORS[si]}` : "1px solid #2a2a3e",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: STATE_COLORS[si], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? STATE_COLORS[si] : "#888", minWidth: 100 }}>
                          {si}: {stateName}
                        </span>
                        {cell && (
                          <TilePreviewCanvas src={selectedTileset} col={cell.col} row={cell.row} size={32} />
                        )}
                        <span style={{ fontSize: 10, color: "#555" }}>
                          ({cell?.col},{cell?.row})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* All quadrant overview */}
              <div style={cardStyle}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#aaa" }}>All 20 Quadrant Mappings</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                  {QUADRANT_NAMES.map((qn, qi) => (
                    <div key={qi} style={{ background: "#16162a", borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#aaa", marginBottom: 6, textAlign: "center" }}>{qn}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {STATE_NAMES.map((sn, si) => {
                          const cell = currentQuadMap[qi]?.[si];
                          return (
                            <div key={si} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATE_COLORS[si] }} />
                              {cell && <TilePreviewCanvas src={selectedTileset} col={cell.col} row={cell.row} size={20} />}
                              <span style={{ fontSize: 9, color: "#666" }}>{sn}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Cardinal tab ─── */}
          {activeTab === "cardinal" && (
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: "#aaa" }}>
                  4-bit Cardinal Bitmask (N=1 E=2 S=4 W=8)
                </h3>
                <button onClick={handleCardinalReset} style={{ ...btnStyle, background: "#2a1a1a", color: "#d95c5c", border: "1px solid #d95c5c" }}>
                  Reset
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#666", margin: "0 0 10px", lineHeight: 1.5 }}>
                Select a bitmask case, then click a tileset cell to assign. Used for path tiles (4×4 grid).
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {Array.from({ length: 16 }, (_, i) => {
                  const entry = currentCardinalMap[i];
                  const isSelected = selectedCase === i;
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedCase(i)}
                      style={{
                        padding: 6,
                        borderRadius: 6,
                        border: isSelected ? "2px solid #ffdd00" : "1px solid #333",
                        background: isSelected ? "#2a2a4e" : "#16162a",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <div style={{ fontSize: 10, color: isSelected ? "#ffdd00" : "#888", fontWeight: 600 }}>
                        {i}: {BITMASK_LABELS[i]}
                      </div>
                      <NeighborDiagram mask={i} />
                      {entry && <TilePreviewCanvas src={selectedTileset} col={entry.col} row={entry.row} size={32} />}
                      <div style={{ fontSize: 9, color: "#555" }}>({entry?.col},{entry?.row})</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Linear tab ─── */}
          {activeTab === "linear" && (
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14, color: "#aaa" }}>
                  Linear Auto-Tile (8 states)
                </h3>
                <button onClick={handleLinearReset} style={{ ...btnStyle, background: "#2a1a1a", color: "#d95c5c", border: "1px solid #d95c5c" }}>
                  Reset
                </button>
              </div>
              <p style={{ fontSize: 11, color: "#666", margin: "0 0 10px", lineHeight: 1.5 }}>
                Bridge-type tiles with no corners. Only straight segments: vertical ends/mid, horizontal ends/mid,
                cross intersection, and isolated. For isolated tiles, the renderer checks nearby land to auto-detect
                horizontal vs vertical orientation. Select a state, then click a tileset cell.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {LINEAR_STATE_LABELS.map((label, i) => {
                  const entry = currentLinearMap[i];
                  const isSelected = selectedLinearState === i;
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedLinearState(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        background: isSelected ? "#2a2a4e" : "#16162a",
                        borderRadius: 8,
                        border: isSelected ? "2px solid #f59e0b" : "1px solid #2a2a3e",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? "#f59e0b" : "#888", minWidth: 20 }}>
                        {i}
                      </span>
                      <span style={{ fontSize: 12, color: isSelected ? "#f59e0b" : "#aaa", minWidth: 140 }}>
                        {label}
                      </span>
                      {entry && (
                        <TilePreviewCanvas src={selectedTileset} col={entry.col} row={entry.row} size={32} />
                      )}
                      <span style={{ fontSize: 10, color: "#555" }}>
                        ({entry?.col},{entry?.row})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Center Variants tab ─── */}
          {activeTab === "variants" && (
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#aaa" }}>
                Random Center Tile Variants
              </h3>
              <p style={{ fontSize: 11, color: "#666", margin: "0 0 12px", lineHeight: 1.5 }}>
                Add alternative tiles for center/fill areas (e.g. flowers, rock patches).
                When a tile is fully surrounded (center fill), the renderer can randomly pick from
                these variants based on weight. Click on the tileset to add a variant.
                The remaining weight goes to the default center tile.
              </p>

              {currentVariants.length === 0 ? (
                <p style={{ color: "#555", fontSize: 12, fontStyle: "italic" }}>
                  No variants yet. Click tileset cells to add random center variants.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* Default center tile */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    background: "#16162a", borderRadius: 8, border: "1px solid #22c55e44",
                  }}>
                    <TilePreviewCanvas
                      src={selectedTileset}
                      col={currentQuadMap[0]?.[3]?.col ?? 1}
                      row={currentQuadMap[0]?.[3]?.row ?? 1}
                      size={32}
                    />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#22c55e" }}>Default Center</span>
                    <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>
                      {Math.max(0, 100 - currentVariants.reduce((s, v) => s + v.weight, 0))}% chance
                    </span>
                  </div>

                  {currentVariants.map((v, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                        background: "#16162a", borderRadius: 8, border: "1px solid #06b6d444",
                      }}
                    >
                      <TilePreviewCanvas src={selectedTileset} col={v.col} row={v.row} size={32} />
                      <span style={{ fontSize: 11, color: "#888" }}>({v.col},{v.row})</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={v.weight}
                          onChange={(e) => handleVariantWeight(idx, Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))}
                          style={{ ...inputStyle, width: 50, textAlign: "center" }}
                        />
                        <span style={{ fontSize: 11, color: "#888" }}>%</span>
                        <button
                          onClick={() => handleRemoveVariant(idx)}
                          style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>
                    Total variant weight: {currentVariants.reduce((s, v) => s + v.weight, 0)}%.
                    Default center gets the remainder.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Overlay Layer Preview */}
      {overlayTiles.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Tileset Overlay Layers</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {overlayTiles.map((t) => (
              <OverlayPreview key={t.id} name={t.name} baseSrc={t.tilesetSrc!} overlaySrc={t.overlaySrc!} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
