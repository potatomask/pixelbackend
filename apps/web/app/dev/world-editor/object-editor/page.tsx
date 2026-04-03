"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { TILESET_TILE_SIZE, getUniqueTilesetSources } from "@mypixelpage/shared";
import type {
  ObjectDef,
  ObjectVariation,
  CollisionShape,
  CollisionShapeType,
  AnimationDef,
  TagDef,
} from "@mypixelpage/shared";
import { DEFAULT_TAGS, DEFAULT_COLLISION, loadTagsFromStorage } from "@mypixelpage/shared";
import { syncSettingToServer, loadSettingFromServer, autoHealSettings } from "@/lib/utils/dev-settings-sync";
import { useNotify } from "@/components/notifications";

/* ── Constants ──────────────────────────────────── */
const OBJ_STORAGE_KEY = "dev-objects";
const ANIM_STORAGE_KEY = "dev-animations";
const CUSTOM_SRC_KEY = "dev-custom-tileset-sources";
const FREE_TIER_OK_MIGRATION_KEY = "dev-free-tier-ok-migration-objects-v1";
const PREVIEW_SCALE = 10; // display scale for collision editor

/* ── Persistence ────────────────────────────────── */
function loadCustomSources(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_SRC_KEY) ?? "[]");
  } catch { return []; }
}
function saveCustomSources(srcs: string[]) {
  localStorage.setItem(CUSTOM_SRC_KEY, JSON.stringify(srcs));
  syncSettingToServer(CUSTOM_SRC_KEY, JSON.stringify(srcs));
}
function loadObjects(): ObjectDef[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(OBJ_STORAGE_KEY) ?? "[]");
  } catch { return []; }
}
function saveObjects(objs: ObjectDef[]) {
  localStorage.setItem(OBJ_STORAGE_KEY, JSON.stringify(objs));
  syncSettingToServer(OBJ_STORAGE_KEY, JSON.stringify(objs));
}
function loadAnimations(): AnimationDef[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ANIM_STORAGE_KEY) ?? "[]");
  } catch { return []; }
}

/* ── Styles ─────────────────────────────────────── */
const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "#111118",
  color: "#e0e0e0",
  padding: "24px 28px",
  fontFamily: "system-ui, sans-serif",
};
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

/* ── Z-Interaction Editor canvas ────────────────── */
function ZInteractionEditor({
  zLine,
  onZLineChange,
  tilesetSrc,
  srcX,
  srcY,
  widthTiles,
  heightTiles,
}: {
  zLine: number;
  onZLineChange: (v: number) => void;
  tilesetSrc: string;
  srcX: number;
  srcY: number;
  widthTiles: number;
  heightTiles: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);

  const pxW = widthTiles * TILESET_TILE_SIZE * PREVIEW_SCALE;
  const pxH = heightTiles * TILESET_TILE_SIZE * PREVIEW_SCALE;

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    cvs.width = pxW;
    cvs.height = pxH;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, pxW, pxH);

    // Draw checkerboard bg
    const bs = 8;
    for (let y = 0; y < pxH; y += bs) {
      for (let x = 0; x < pxW; x += bs) {
        ctx.fillStyle = ((x + y) / bs) % 2 === 0 ? "#1a1a2e" : "#222244";
        ctx.fillRect(x, y, bs, bs);
      }
    }

    // Draw sprite
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(
        img,
        srcX, srcY,
        widthTiles * TILESET_TILE_SIZE, heightTiles * TILESET_TILE_SIZE,
        0, 0, pxW, pxH,
      );

      // Draw z-interaction line
      const lineY = zLine * pxH;
      ctx.save();

      // Semi-transparent zones
      ctx.fillStyle = "rgba(255, 221, 0, 0.08)";
      ctx.fillRect(0, 0, pxW, lineY);
      ctx.fillStyle = "rgba(255, 221, 0, 0.04)";
      ctx.fillRect(0, lineY, pxW, pxH - lineY);

      // Line
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#ffdd00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(pxW, lineY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Handle (grabbable bar)
      ctx.fillStyle = "#ffdd00";
      const handleW = 40;
      const handleH = 6;
      ctx.fillRect(pxW / 2 - handleW / 2, lineY - handleH / 2, handleW, handleH);

      // Labels
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "#ffdd00";
      ctx.fillText("BEHIND", 4, Math.max(14, lineY - 6));
      ctx.fillText("IN FRONT", 4, Math.min(pxH - 4, lineY + 14));

      // Percentage label
      ctx.fillStyle = "rgba(255, 221, 0, 0.7)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(zLine * 100)}%`, pxW - 4, Math.max(14, lineY - 6));
      ctx.textAlign = "left";

      ctx.restore();
    };
    img.src = tilesetSrc;
  }, [zLine, tilesetSrc, srcX, srcY, widthTiles, heightTiles, pxW, pxH]);

  const getLineY = useCallback((e: React.MouseEvent) => {
    const cvs = canvasRef.current!;
    const rect = cvs.getBoundingClientRect();
    const my = (e.clientY - rect.top) * (cvs.height / rect.height);
    return Math.max(0, Math.min(1, my / pxH));
  }, [pxH]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const y = getLineY(e);
    // Check if near the line (within ~10px threshold)
    if (Math.abs(y - zLine) < 12 / pxH) {
      dragging.current = true;
    }
  }, [zLine, pxH, getLineY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    onZLineChange(Math.round(getLineY(e) * 100) / 100);
  }, [getLineY, onZLineChange]);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: dragging.current ? "ns-resize" : "default",
          borderRadius: 6,
          border: "1px solid #444",
          maxWidth: "100%",
          display: "block",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <label style={{ fontSize: 10, color: "#666" }}>Z-Line Y</label>
        <input
          style={{ ...inputStyle, width: 70 }}
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={Math.round(zLine * 100) / 100}
          onChange={(e) => onZLineChange(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
        />
        <span style={{ fontSize: 10, color: "#555" }}>0 = top, 1 = bottom</span>
      </div>
    </div>
  );
}

/* ── Collision Editor canvas ────────────────────── */
function CollisionEditor({
  collision,
  onChange,
  tilesetSrc,
  srcX,
  srcY,
  widthTiles,
  heightTiles,
  zInteraction,
}: {
  collision: CollisionShape;
  onChange: (c: CollisionShape) => void;
  tilesetSrc: string;
  srcX: number;
  srcY: number;
  widthTiles: number;
  heightTiles: number;
  zInteraction: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<string | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0, ow: 0, oh: 0 });

  const pxW = widthTiles * TILESET_TILE_SIZE * PREVIEW_SCALE;
  const pxH = heightTiles * TILESET_TILE_SIZE * PREVIEW_SCALE;

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    cvs.width = pxW;
    cvs.height = pxH;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, pxW, pxH);

    // Draw checkerboard bg
    const bs = 8;
    for (let y = 0; y < pxH; y += bs) {
      for (let x = 0; x < pxW; x += bs) {
        ctx.fillStyle = ((x + y) / bs) % 2 === 0 ? "#1a1a2e" : "#222244";
        ctx.fillRect(x, y, bs, bs);
      }
    }

    // Draw sprite
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(
        img,
        srcX, srcY,
        widthTiles * TILESET_TILE_SIZE, heightTiles * TILESET_TILE_SIZE,
        0, 0, pxW, pxH,
      );

      // Draw collision shape
      const cx = collision.x * pxW;
      const cy = collision.y * pxH;
      const cw = collision.w * pxW;
      const ch = collision.h * pxH;

      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.fillStyle = "rgba(239, 68, 68, 0.15)";

      if (collision.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(cx + cw / 2, cy + ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(cx, cy, cw, ch);
        ctx.strokeRect(cx, cy, cw, ch);
      }

      // Z-interaction line (at collision center)
      if (zInteraction) {
        const lineY = cy + ch / 2; // midpoint of collision box = z-sorting line
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "#ffdd00";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(pxW, lineY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.fillStyle = "#ffdd00";
        ctx.font = "bold 11px monospace";
        ctx.fillText("BEHIND", 4, lineY - 6);
        ctx.fillText("IN FRONT", 4, lineY + 14);
      }

      // Resize handles
      const handleSize = 8;
      ctx.fillStyle = "#fff";
      // corners
      const corners = [
        [cx, cy], [cx + cw, cy],
        [cx, cy + ch], [cx + cw, cy + ch],
      ];
      for (const [hx, hy] of corners) {
        ctx.fillRect(hx! - handleSize / 2, hy! - handleSize / 2, handleSize, handleSize);
      }
      // center (for moving)
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(cx + cw / 2 - handleSize / 2, cy + ch / 2 - handleSize / 2, handleSize, handleSize);

      ctx.restore();
    };
    img.src = tilesetSrc;
  }, [collision, tilesetSrc, srcX, srcY, widthTiles, heightTiles, pxW, pxH, zInteraction]);

  const getMousePos = (e: React.MouseEvent) => {
    const cvs = canvasRef.current!;
    const rect = cvs.getBoundingClientRect();
    return {
      mx: (e.clientX - rect.left) * (cvs.width / rect.width),
      my: (e.clientY - rect.top) * (cvs.height / rect.height),
    };
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const { mx, my } = getMousePos(e);
      const cx = collision.x * pxW;
      const cy = collision.y * pxH;
      const cw = collision.w * pxW;
      const ch = collision.h * pxH;
      const threshold = 12;

      // Check corners first
      const corners = [
        { name: "tl", hx: cx, hy: cy },
        { name: "tr", hx: cx + cw, hy: cy },
        { name: "bl", hx: cx, hy: cy + ch },
        { name: "br", hx: cx + cw, hy: cy + ch },
      ];
      for (const c of corners) {
        if (Math.abs(mx - c.hx) < threshold && Math.abs(my - c.hy) < threshold) {
          dragging.current = c.name;
          dragStart.current = { mx, my, ox: collision.x, oy: collision.y, ow: collision.w, oh: collision.h };
          return;
        }
      }
      // Check center (move)
      if (mx >= cx && mx <= cx + cw && my >= cy && my <= cy + ch) {
        dragging.current = "move";
        dragStart.current = { mx, my, ox: collision.x, oy: collision.y, ow: collision.w, oh: collision.h };
      }
    },
    [collision, pxW, pxH],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging.current) return;
      const { mx, my } = getMousePos(e);
      const dx = (mx - dragStart.current.mx) / pxW;
      const dy = (my - dragStart.current.my) / pxH;
      const { ox, oy, ow, oh } = dragStart.current;

      let nx = collision.x, ny = collision.y, nw = collision.w, nh = collision.h;

      switch (dragging.current) {
        case "move":
          nx = Math.max(0, Math.min(1 - ow, ox + dx));
          ny = Math.max(0, Math.min(1 - oh, oy + dy));
          nw = ow; nh = oh;
          break;
        case "br":
          nw = Math.max(0.05, Math.min(1 - ox, ow + dx));
          nh = Math.max(0.05, Math.min(1 - oy, oh + dy));
          break;
        case "bl":
          nx = Math.max(0, Math.min(ox + ow - 0.05, ox + dx));
          nw = Math.max(0.05, ow - dx);
          nh = Math.max(0.05, Math.min(1 - oy, oh + dy));
          break;
        case "tr":
          nw = Math.max(0.05, Math.min(1 - ox, ow + dx));
          ny = Math.max(0, Math.min(oy + oh - 0.05, oy + dy));
          nh = Math.max(0.05, oh - dy);
          break;
        case "tl":
          nx = Math.max(0, Math.min(ox + ow - 0.05, ox + dx));
          ny = Math.max(0, Math.min(oy + oh - 0.05, oy + dy));
          nw = Math.max(0.05, ow - dx);
          nh = Math.max(0.05, oh - dy);
          break;
      }

      onChange({ ...collision, x: nx, y: ny, w: nw, h: nh });
    },
    [collision, pxW, pxH, onChange],
  );

  const handleMouseUp = useCallback(() => {
    dragging.current = null;
  }, []);

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: dragging.current ? "grabbing" : "crosshair",
          borderRadius: 6,
          border: "1px solid #444",
          maxWidth: "100%",
        }}
      />
      {/* Shape type toggle */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {(["rectangle", "ellipse"] as CollisionShapeType[]).map((shape) => (
          <button
            key={shape}
            onClick={() => onChange({ ...collision, type: shape })}
            style={{
              ...btnStyle,
              flex: 1,
              fontSize: 12,
              padding: "6px 10px",
              background: collision.type === shape ? "#ef4444" : "#2a2a3e",
              color: collision.type === shape ? "#fff" : "#888",
            }}
          >
            {shape === "rectangle" ? "Rectangle" : "Ellipse"}
          </button>
        ))}
      </div>
      {/* Numeric inputs for precision */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 8 }}>
        {(["x", "y", "w", "h"] as const).map((prop) => (
          <div key={prop}>
            <label style={{ fontSize: 10, color: "#666" }}>{prop.toUpperCase()}</label>
            <input
              style={{ ...inputStyle, fontSize: 11, padding: "3px 6px" }}
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={Math.round(collision[prop] * 100) / 100}
              onChange={(e) => {
                const v = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
                onChange({ ...collision, [prop]: v });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tileset Grid Picker ────────────────────────── */
function TilesetGridPicker({
  src,
  srcX,
  srcY,
  widthTiles,
  heightTiles,
  onSelect,
}: {
  src: string;
  srcX: number;
  srcY: number;
  widthTiles: number;
  heightTiles: number;
  onSelect: (srcX: number, srcY: number) => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const SCALE = 3;

  React.useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  const gridCols = img ? Math.floor(img.width / TILESET_TILE_SIZE) : 0;
  const gridRows = img ? Math.floor(img.height / TILESET_TILE_SIZE) : 0;
  const cellPx = TILESET_TILE_SIZE * SCALE;

  React.useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !img) return;
    const w = img.width * SCALE;
    const h = img.height * SCALE;
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;

    // Draw checkerboard
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

    // Highlight selected region
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

    // Cell coords
    ctx.font = "8px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        ctx.fillText(`${c},${r}`, c * cellPx + 2, r * cellPx + 8);
      }
    }
  }, [img, srcX, srcY, widthTiles, heightTiles, gridCols, gridRows, cellPx, SCALE]);

  const handleClick = React.useCallback(
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

  if (!src) return null;

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

/* ── Object preview ─────────────────────────────── */
function ObjectPreview({
  tilesetSrc,
  srcX,
  srcY,
  widthTiles,
  heightTiles,
  size = 48,
  horizontalFlip = false,
}: {
  tilesetSrc: string;
  srcX: number;
  srcY: number;
  widthTiles: number;
  heightTiles: number;
  size?: number;
  horizontalFlip?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    if (!tilesetSrc) return;
    const img = new Image();
    img.onload = () => {
      const sw = widthTiles * TILESET_TILE_SIZE;
      const sh = heightTiles * TILESET_TILE_SIZE;
      const aspect = sw / sh;
      let dw = size, dh = size;
      if (aspect > 1) { dh = size / aspect; } else { dw = size * aspect; }
      const dx = (size - dw) / 2;
      const dy = (size - dh) / 2;
      ctx.save();
      if (horizontalFlip) {
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, srcX, srcY, sw, sh, dx, dy, dw, dh);
      ctx.restore();
    };
    img.src = tilesetSrc;
  }, [tilesetSrc, srcX, srcY, widthTiles, heightTiles, size, !!horizontalFlip]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ borderRadius: 4, imageRendering: "pixelated", border: "1px solid #444", background: "#0a0a0a" }}
    />
  );
}

/* ── Main page ──────────────────────────────────── */
export default function ObjectEditorPage() {
  const [objects, setObjects] = useState<ObjectDef[]>([]);
  const [animations, setAnimations] = useState<AnimationDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("object");
  const [tags, setTags] = useState<string[]>([]);
  const [canPlaceOn, setCanPlaceOn] = useState<string[]>([]);
  const [tilesetSrc, setTilesetSrc] = useState(getUniqueTilesetSources()[0] ?? "");
  const [srcX, setSrcX] = useState(0);
  const [srcY, setSrcY] = useState(0);
  const [widthTiles, setWidthTiles] = useState(1);
  const [heightTiles, setHeightTiles] = useState(1);
  const [zLayer, setZLayer] = useState(1);
  const [hasCollision, setHasCollision] = useState(true);
  const [collision, setCollision] = useState<CollisionShape>({ ...DEFAULT_COLLISION });
  const [zInteraction, setZInteraction] = useState(true);
  const [zLine, setZLine] = useState(1);
  const [animationId, setAnimationId] = useState<string | null>(null);
  const [colliderTiles, setColliderTiles] = useState<{ dx: number; dy: number }[]>([{ dx: 0, dy: 0 }]);
  const [variations, setVariations] = useState<ObjectVariation[]>([]);
  const [collapsedVariations, setCollapsedVariations] = useState<Record<number, boolean>>({});
  const [isInteractable, setIsInteractable] = useState(false);
  const [isFreeTierOk, setIsFreeTierOk] = useState(true);
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [allTags, setAllTags] = useState<TagDef[]>(DEFAULT_TAGS);
  const [horizontalFlip, setHorizontalFlip] = useState(false);
  const { confirm } = useNotify();

  useEffect(() => {
    // Load from server first (writes to localStorage), then read from localStorage
    Promise.all([
      loadSettingFromServer("dev-objects"),
      loadSettingFromServer("dev-animations"),
      loadSettingFromServer("dev-custom-tileset-sources"),
    ]).then(([serverObjs, serverAnims, serverSrcs]) => {
      const objs = loadObjects();
      let normalized = objs;
      if (typeof window !== "undefined" && !localStorage.getItem(FREE_TIER_OK_MIGRATION_KEY)) {
        normalized = objs.map((o) => ({ ...o, freeTierOk: true }));
        saveObjects(normalized);
        localStorage.setItem(FREE_TIER_OK_MIGRATION_KEY, "1");
      }
      setObjects(normalized);
      setAnimations(loadAnimations());
      setAllTags(loadTagsFromStorage());
      const persisted = loadCustomSources();
      const fromObjects = normalized.map((o) => o.tilesetSrc).filter(Boolean);
      const builtIn = new Set(getUniqueTilesetSources());
      const merged = [...new Set([...persisted, ...fromObjects])].filter((s) => !builtIn.has(s));
      setCustomSources(merged);
      autoHealSettings([["dev-objects", serverObjs], ["dev-animations", serverAnims], ["dev-custom-tileset-sources", serverSrcs]]);
    });
  }, []);

  const tilesetSources = [...new Set([...getUniqueTilesetSources(), ...customSources])];

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

    // Try the API upload first (saves to public/tilesets/)
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
    } catch { /* API unavailable, fall through */ }

    // Fallback: convert to data URL so the image actually works
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      addCustomSource(dataUrl);
      setUploadStatus(`Loaded: ${file.name}`);
    };
    reader.onerror = () => setUploadStatus("Failed to read file");
    reader.readAsDataURL(file);
  }, [addCustomSource]);

  const resetForm = () => {
    setSelectedId(null);
    setName("");
    setCategory("object");
    setTags([]);
    setCanPlaceOn([]);
    setSrcX(0);
    setSrcY(0);
    setWidthTiles(1);
    setHeightTiles(1);
    setZLayer(1);
    setHasCollision(true);
    setCollision({ ...DEFAULT_COLLISION });
    setZInteraction(true);
    setZLine(1);
    setAnimationId(null);
    setColliderTiles([{ dx: 0, dy: 0 }]);
    setVariations([]);
    setCollapsedVariations({});
    setIsInteractable(false);
    setIsFreeTierOk(true);
    setHorizontalFlip(false);
  };

  const handleSave = useCallback(() => {
    if (!name.trim()) return;
    const id = selectedId ?? `obj_${Date.now()}`;
    const obj: ObjectDef = {
      id,
      name: name.trim(),
      category: tags[0] ?? "object",
      tags: [...tags],
      canPlaceOn: [...canPlaceOn],
      tilesetSrc,
      srcX,
      srcY,
      widthTiles,
      heightTiles,
      zLayer,
      collision: hasCollision ? { ...collision } : null,
      zInteraction: zInteraction ?? true,
      zLine: hasCollision ? collision.y + collision.h / 2 : zLine,
      animationId,
      colliderTiles: [...colliderTiles],
      horizontalFlip: horizontalFlip || undefined,
      variations: variations.length > 0 ? variations.map((v) => ({ ...v })) : undefined,
      interactable: isInteractable || undefined,
      freeTierOk: isFreeTierOk,
    };
    const updated = selectedId
      ? objects.map((o) => (o.id === selectedId ? obj : o))
      : [...objects, obj];
    setObjects(updated);
    saveObjects(updated);
    resetForm();
  }, [name, category, tags, canPlaceOn, tilesetSrc, srcX, srcY, widthTiles, heightTiles, zLayer, hasCollision, collision, zInteraction, zLine, animationId, colliderTiles, variations, selectedId, objects, isInteractable, isFreeTierOk, horizontalFlip]);

  const handleEdit = useCallback((obj: ObjectDef) => {
    setSelectedId(obj.id);
    setName(obj.name);
    setCategory(obj.category);
    setTags([...obj.tags]);
    setCanPlaceOn([...(obj.canPlaceOn ?? [])]);
    setTilesetSrc(obj.tilesetSrc);
    setSrcX(obj.srcX);
    setSrcY(obj.srcY);
    setWidthTiles(obj.widthTiles);
    setHeightTiles(obj.heightTiles);
    setZLayer(obj.zLayer);
    setHasCollision(obj.collision !== null);
    setCollision(obj.collision ?? { ...DEFAULT_COLLISION });
    setZInteraction(obj.zInteraction ?? true);
    setZLine(obj.zLine ?? 1);
    setAnimationId(obj.animationId);
    setColliderTiles(obj.colliderTiles?.length ? [...obj.colliderTiles] : [{ dx: 0, dy: 0 }]);
    const loadedVariations = obj.variations ? obj.variations.map((v) => ({ ...v })) : [];
    setVariations(loadedVariations);
    setCollapsedVariations(Object.fromEntries(loadedVariations.map((_, i) => [i, true])));
    setIsInteractable(obj.interactable ?? false);
    setIsFreeTierOk(obj.freeTierOk ?? true);
    setHorizontalFlip(obj.horizontalFlip ?? false);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      const obj = objects.find((o) => o.id === id);
      confirm(
        `Delete object "${obj?.name || id}"? This cannot be undone.`,
        () => {
          const updated = objects.filter((o) => o.id !== id);
          setObjects(updated);
          saveObjects(updated);
          if (selectedId === id) resetForm();
        },
        { title: "Delete Object", confirmText: "Delete", cancelText: "Cancel" },
      );
    },
    [objects, selectedId, confirm],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const obj = objects.find((o) => o.id === id);
      if (!obj) return;
      const dup: ObjectDef = {
        ...obj,
        id: `obj_${Date.now()}`,
        name: `${obj.name} (copy)`,
        variations: obj.variations ? obj.variations.map((v) => ({ ...v })) : undefined,
      };
      const updated = [...objects, dup];
      setObjects(updated);
      saveObjects(updated);
    },
    [objects],
  );

  // Z-interaction line Y description
  const zLineDesc = hasCollision
    ? `Y = collision center (${Math.round((collision.y + collision.h / 2) * 100)}%)`
    : "Y = 50% (no collision)";

  return (
    <div style={pageBg}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Object Editor</h1>
          <p style={{ color: "#888", fontSize: 13, margin: "4px 0 0" }}>
            Define objects — trees, items, interactables — with collision shapes, z-index interaction, and animation links.
          </p>
        </div>
        <a href="/dev/world-editor" style={{ ...btnStyle, background: "#333", color: "#ccc", textDecoration: "none" }}>
          ← Dev Tiles
        </a>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* LEFT: Object list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, order: 2 }}>
          {objects.length === 0 ? (
            <div style={cardStyle}>
              <p style={{ color: "#555", fontSize: 13, fontStyle: "italic" }}>
                No objects defined yet. Use the form above to create one.
              </p>
            </div>
          ) : (
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#aaa" }}>
                Objects ({objects.length})
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {objects.map((obj) => {
                  return (
                    <div
                      key={obj.id}
                      onClick={() => handleEdit(obj)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        background: selectedId === obj.id ? "#2a2a4e" : "#16162a",
                        borderRadius: 8,
                        border: selectedId === obj.id ? "1px solid #c084fc" : "1px solid #2a2a3e",
                        cursor: "pointer",
                      }}
                    >
                      <ObjectPreview
                        tilesetSrc={obj.tilesetSrc}
                        srcX={obj.srcX}
                        srcY={obj.srcY}
                        widthTiles={obj.widthTiles}
                        heightTiles={obj.heightTiles}
                        horizontalFlip={obj.horizontalFlip}
                        size={40}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{obj.name}</div>
                        <div style={{ fontSize: 11, color: "#666", display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span>{obj.widthTiles}×{obj.heightTiles}</span>
                          <span>z{obj.zLayer}</span>
                          {obj.collision && <span style={{ color: "#ef4444" }}>col</span>}
                          {obj.zInteraction && <span style={{ color: "#ffdd00" }}>zInt</span>}
                          {obj.animationId && <span style={{ color: "#f59e0b" }}>anim</span>}
                        </div>
                        {obj.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 2 }}>
                            {obj.tags.map((tagId) => {
                              const t = allTags.find((at) => at.id === tagId);
                              return t ? (
                                <span key={tagId} style={{
                                  fontSize: 9, padding: "1px 5px", borderRadius: 3,
                                  background: t.color + "22", color: t.color,
                                  border: `1px solid ${t.color}44`,
                                }}>
                                  {t.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDuplicate(obj.id); }}
                        style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 14, padding: "0 2px" }}
                        title="Duplicate"
                      >
                        ⧉
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(obj.id); }}
                        style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 16 }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Form */}
        <div style={{ ...cardStyle, order: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>
            {selectedId ? "Edit Object" : "New Object"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 12, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Name */}
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Name</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Oak Tree"
                />
              </div>

              {/* Tags (what this object IS) */}
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Tags (what this object is)</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {allTags.map((tag) => {
                    const active = tags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() =>
                          setTags((prev) =>
                            active ? prev.filter((t) => t !== tag.id) : [...prev, tag.id],
                          )
                        }
                        style={{
                          padding: "2px 8px",
                          borderRadius: 12,
                          border: active ? `1px solid ${tag.color}` : "1px solid #333",
                          background: active ? tag.color + "22" : "#1a1a28",
                          color: active ? tag.color : "#666",
                          fontSize: 10,
                          cursor: "pointer",
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Can Place On (where this object can go) */}
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Can Place On (empty = anywhere)</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {allTags.map((tag) => {
                    const active = canPlaceOn.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() =>
                          setCanPlaceOn((prev) =>
                            active ? prev.filter((t) => t !== tag.id) : [...prev, tag.id],
                          )
                        }
                        style={{
                          padding: "2px 8px",
                          borderRadius: 12,
                          border: active ? `1px solid ${tag.color}` : "1px solid #333",
                          background: active ? tag.color + "22" : "#1a1a28",
                          color: active ? tag.color : "#666",
                          fontSize: 10,
                          cursor: "pointer",
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tileset + position */}
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Tileset Source</label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={tilesetSrc}
                  onChange={(e) => setTilesetSrc(e.target.value)}
                >
                  {tilesetSources.map((src) => (
                    <option key={src} value={src}>{src.split("/").pop()}</option>
                  ))}
                </select>
                <div style={{ marginTop: 4, display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png"
                    onChange={handleUploadTexture}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ ...btnStyle, background: "#2a2a3e", color: "#aaa", fontSize: 11, padding: "4px 10px" }}
                  >
                    Upload PNG…
                  </button>
                  {uploadStatus && (
                    <span style={{ fontSize: 11, color: "#888" }}>{uploadStatus}</span>
                  )}
                </div>
              </div>

              {/* Source picker + object sizing/preview */}
              {tilesetSrc ? (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 260px", gap: 8, alignItems: "start" }}>
                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                      Click to select source region ({TILESET_TILE_SIZE}×{TILESET_TILE_SIZE}px cells)
                    </label>
                    <TilesetGridPicker
                      src={tilesetSrc}
                      srcX={srcX}
                      srcY={srcY}
                      widthTiles={widthTiles}
                      heightTiles={heightTiles}
                      onSelect={(newSrcX, newSrcY) => { setSrcX(newSrcX); setSrcY(newSrcY); }}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: "#666" }}>W tiles</label>
                        <input style={inputStyle} type="number" min={1} max={8} value={widthTiles}
                          onChange={(e) => setWidthTiles(Math.max(1, parseInt(e.target.value, 10) || 1))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#666" }}>H tiles</label>
                        <input style={inputStyle} type="number" min={1} max={8} value={heightTiles}
                          onChange={(e) => setHeightTiles(Math.max(1, parseInt(e.target.value, 10) || 1))} />
                      </div>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer", margin: "0" }}>
                      <input
                        type="checkbox"
                        checked={horizontalFlip}
                        onChange={(e) => setHorizontalFlip(e.target.checked)}
                      />
                      <span>Mirror horizontally</span>
                    </label>

                    <details style={{ fontSize: 11, color: "#555" }}>
                      <summary style={{ cursor: "pointer", marginBottom: 4 }}>Fine-tune position (px)</summary>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: "#666" }}>srcX</label>
                          <input style={inputStyle} type="number" min={0} value={srcX}
                            onChange={(e) => setSrcX(parseInt(e.target.value, 10) || 0)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: "#666" }}>srcY</label>
                          <input style={inputStyle} type="number" min={0} value={srcY}
                            onChange={(e) => setSrcY(parseInt(e.target.value, 10) || 0)} />
                        </div>
                      </div>
                    </details>

                    <div>
                      <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Z-Layer</label>
                      <input style={inputStyle} type="number" min={0} max={10} value={zLayer}
                        onChange={(e) => setZLayer(parseInt(e.target.value, 10) || 0)} />
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", padding: 6 }}>
                      <ObjectPreview
                        tilesetSrc={tilesetSrc}
                        srcX={srcX}
                        srcY={srcY}
                        widthTiles={widthTiles}
                        heightTiles={heightTiles}
                        horizontalFlip={horizontalFlip}
                        size={72}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ fontSize: 10, color: "#666" }}>W tiles</label>
                      <input style={inputStyle} type="number" min={1} max={8} value={widthTiles}
                        onChange={(e) => setWidthTiles(Math.max(1, parseInt(e.target.value, 10) || 1))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: "#666" }}>H tiles</label>
                      <input style={inputStyle} type="number" min={1} max={8} value={heightTiles}
                        onChange={(e) => setHeightTiles(Math.max(1, parseInt(e.target.value, 10) || 1))} />
                    </div>
                  </div>

                  <details style={{ fontSize: 11, color: "#555" }}>
                    <summary style={{ cursor: "pointer", marginBottom: 4 }}>Fine-tune position (px)</summary>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: "#666" }}>srcX</label>
                        <input style={inputStyle} type="number" min={0} value={srcX}
                          onChange={(e) => setSrcX(parseInt(e.target.value, 10) || 0)} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#666" }}>srcY</label>
                        <input style={inputStyle} type="number" min={0} value={srcY}
                          onChange={(e) => setSrcY(parseInt(e.target.value, 10) || 0)} />
                      </div>
                    </div>
                  </details>

                  <div>
                    <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Z-Layer</label>
                    <input style={inputStyle} type="number" min={0} max={10} value={zLayer}
                      onChange={(e) => setZLayer(parseInt(e.target.value, 10) || 0)} />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Collider Tiles */}
              {(widthTiles > 1 || heightTiles > 1) && (
                <div style={{ borderTop: "1px solid #333", paddingTop: 8 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: "#38bdf8", display: "block", marginBottom: 6 }}>
                    Collider Tiles
                  </label>
                  <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px", lineHeight: 1.4 }}>
                    Click to select one tile (Shift+click to multi-select). Bottom-left is the anchor.
                  </p>
                  <div style={{ display: "inline-grid", gridTemplateColumns: `repeat(${widthTiles}, 36px)`, gap: 2 }}>
                    {Array.from({ length: heightTiles }).map((_, row) =>
                      Array.from({ length: widthTiles }).map((_, col) => {
                        const dx = col;
                        const dy = heightTiles - 1 - row;
                        const isSelected = colliderTiles.some((t) => t.dx === dx && t.dy === dy);
                        return (
                          <button
                            key={`${col}-${row}`}
                            onClick={(e) => {
                              if (e.shiftKey) {
                                setColliderTiles((prev) =>
                                  isSelected
                                    ? prev.filter((t) => !(t.dx === dx && t.dy === dy))
                                    : [...prev, { dx, dy }],
                                );
                              } else {
                                setColliderTiles(isSelected ? [] : [{ dx, dy }]);
                              }
                            }}
                            title={`dx=${dx}, dy=${dy} — click to select only this, Shift+click to toggle`}
                            style={{
                              width: 36,
                              height: 36,
                              border: isSelected ? "2px solid #38bdf8" : "1px solid #444",
                              borderRadius: 4,
                              background: isSelected ? "rgba(56, 189, 248, 0.25)" : "#2a2a3e",
                              cursor: "pointer",
                              fontSize: 9,
                              color: isSelected ? "#38bdf8" : "#555",
                              fontFamily: "monospace",
                            }}
                          >
                            {dx},{dy}
                          </button>
                        );
                      }),
                    )}
                  </div>
                  <p style={{ fontSize: 10, color: "#555", margin: "4px 0 0" }}>
                    {colliderTiles.length} tile{colliderTiles.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
              )}

              {/* Interactable */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid #333", paddingTop: 8, padding: "8px 0" }}>
                <input
                  type="checkbox"
                  checked={isInteractable}
                  onChange={(e) => setIsInteractable(e.target.checked)}
                  style={{ accentColor: "#3b82f6", width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>Interactable</span>
                <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>Users can click / hover this object</span>
              </div>

              {/* Free Tier OK */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
                <input
                  type="checkbox"
                  checked={isFreeTierOk}
                  onChange={(e) => setIsFreeTierOk(e.target.checked)}
                  style={{ accentColor: "#22c55e", width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e0e0e0" }}>Free Tier OK</span>
                <span style={{ fontSize: 11, color: "#888", marginLeft: 4 }}>Available for free-tier users</span>
              </div>

              {/* Collision */}
              <div style={{ borderTop: "1px solid #333", paddingTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: "#ef4444" }}>Collision</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={hasCollision} onChange={(e) => setHasCollision(e.target.checked)} />
                    Enabled
                  </label>
                </div>
                {hasCollision && (
                  <CollisionEditor
                    collision={collision}
                    onChange={setCollision}
                    tilesetSrc={tilesetSrc}
                    srcX={srcX}
                    srcY={srcY}
                    widthTiles={widthTiles}
                    heightTiles={heightTiles}
                    zInteraction={zInteraction}
                  />
                )}
              </div>

              {/* Z-Index Interaction */}
              <div style={{ borderTop: "1px solid #333", paddingTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: "#ffdd00" }}>Z-Index Interaction</label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={zInteraction} onChange={(e) => setZInteraction(e.target.checked)} />
                    Enabled
                  </label>
                </div>
                {!zInteraction ? (
                  <p style={{ fontSize: 11, color: "#666", margin: 0, lineHeight: 1.4, fontStyle: "italic" }}>
                    Z-sorting disabled. This object will always render behind characters.
                  </p>
                ) : hasCollision ? (
                  <p style={{ fontSize: 11, color: "#888", margin: 0, lineHeight: 1.4 }}>
                    Z-line is set to the collision center.
                    <span style={{ color: "#ffdd00" }}>{" "}Y = {Math.round((collision.y + collision.h / 2) * 100)}%</span>
                  </p>
                ) : (
                  <>
                    <p style={{ fontSize: 11, color: "#888", margin: "0 0 10px", lineHeight: 1.4 }}>
                      Drag the yellow line to set where characters appear behind or in front.
                    </p>
                    {tilesetSrc && (
                      <ZInteractionEditor
                        zLine={zLine}
                        onZLineChange={setZLine}
                        tilesetSrc={tilesetSrc}
                        srcX={srcX}
                        srcY={srcY}
                        widthTiles={widthTiles}
                        heightTiles={heightTiles}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Animation link */}
              <div style={{ borderTop: "1px solid #333", paddingTop: 8 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#f59e0b", marginBottom: 6, display: "block" }}>
                  Animation
                </label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={animationId ?? ""}
                  onChange={(e) => setAnimationId(e.target.value || null)}
                >
                  <option value="">None (static)</option>
                  {animations.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.frames.length} frames)</option>
                  ))}
                </select>
                {animations.length === 0 && (
                  <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0" }}>
                    No animations created yet.{" "}
                    <a href="/dev/world-editor/animation-editor" style={{ color: "#4fc3f7", textDecoration: "none" }}>
                      Create one →
                    </a>
                  </p>
                )}
              </div>

              {/* Variations */}
              <div style={{ borderTop: "1px solid #333", paddingTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 14, fontWeight: 600, color: "#c084fc" }}>
                    Variations ({variations.length})
                  </label>
                  <button
                    onClick={() => {
                      setVariations((prev) => {
                        const nextIdx = prev.length;
                        setCollapsedVariations((cv) => ({ ...cv, [nextIdx]: true }));
                        return [...prev, {
                          label: `Var ${prev.length + 1}`,
                          srcX,
                          srcY,
                          widthTiles,
                          heightTiles,
                          tilesetSrc: undefined,
                        }];
                      });
                    }}
                    style={{ ...btnStyle, background: "#2a2a3e", color: "#aaa", fontSize: 11, padding: "3px 10px" }}
                  >
                    + Add
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "#888", margin: "0 0 8px", lineHeight: 1.4 }}>
                  Add visual variations for this object. Players can pick a variation when the object is selected in the editor.
                </p>
                {variations.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {variations.map((v, i) => (
                      <div key={i} style={{ background: "#16162a", borderRadius: 8, padding: 10, border: "1px solid #2a2a3e" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <button
                            type="button"
                            onClick={() => setCollapsedVariations((prev) => ({ ...prev, [i]: !(prev[i] ?? true) }))}
                            style={{ ...btnStyle, background: "#2a2a3e", color: "#aaa", fontSize: 10, padding: "2px 8px" }}
                          >
                            {(collapsedVariations[i] ?? true) ? "Expand" : "Collapse"}
                          </button>
                          <ObjectPreview
                            tilesetSrc={v.tilesetSrc ?? tilesetSrc}
                            srcX={v.srcX}
                            srcY={v.srcY}
                            widthTiles={v.widthTiles ?? widthTiles}
                            heightTiles={v.heightTiles ?? heightTiles}
                            horizontalFlip={v.horizontalFlip}
                            size={36}
                          />
                          <input
                            style={{ ...inputStyle, flex: 1 }}
                            value={v.label}
                            placeholder="Label"
                            onChange={(e) => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, label: e.target.value } : vv))}
                          />
                          <button
                            onClick={() => {
                              setVariations((prev) => prev.filter((_, ii) => ii !== i));
                              setCollapsedVariations((prev) => {
                                const next: Record<number, boolean> = {};
                                for (let idx = 0; idx < variations.length; idx++) {
                                  if (idx === i) continue;
                                  const newIdx = idx > i ? idx - 1 : idx;
                                  next[newIdx] = prev[idx] ?? true;
                                }
                                return next;
                              });
                            }}
                            style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 16 }}
                          >
                            ×
                          </button>
                        </div>
                        {!(collapsedVariations[i] ?? true) && (
                          <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          <div>
                            <label style={{ fontSize: 10, color: "#666" }}>srcX</label>
                            <input style={inputStyle} type="number" min={0} value={v.srcX}
                              onChange={(e) => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, srcX: parseInt(e.target.value, 10) || 0 } : vv))} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#666" }}>srcY</label>
                            <input style={inputStyle} type="number" min={0} value={v.srcY}
                              onChange={(e) => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, srcY: parseInt(e.target.value, 10) || 0 } : vv))} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#666" }}>widthTiles</label>
                            <input style={inputStyle} type="number" min={1} max={16} value={v.widthTiles ?? widthTiles}
                              onChange={(e) => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, widthTiles: Math.max(1, parseInt(e.target.value, 10) || 1) } : vv))} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "#666" }}>heightTiles</label>
                            <input style={inputStyle} type="number" min={1} max={16} value={v.heightTiles ?? heightTiles}
                              onChange={(e) => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, heightTiles: Math.max(1, parseInt(e.target.value, 10) || 1) } : vv))} />
                          </div>
                        </div>
                        {/* Z-Interaction per variant */}
                        <div style={{ marginTop: 6, borderTop: "1px solid #2a2a3e", paddingTop: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={v.collisionEnabled ?? hasCollision}
                                disabled={!hasCollision && v.collisionEnabled !== true}
                                onChange={(e) => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, collisionEnabled: e.target.checked } : vv))}
                              />
                              <span style={{ color: "#ef4444" }}>Collision</span>
                            </label>
                            <button
                              type="button"
                              onClick={() => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, collisionEnabled: undefined } : vv))}
                              style={{ ...btnStyle, background: "#2a2a3e", color: "#aaa", fontSize: 10, padding: "2px 8px" }}
                            >
                              Inherit main
                            </button>
                          </div>
                          <p style={{ fontSize: 10, color: "#777", margin: "0 0 6px" }}>
                            Default follows main object collision ({hasCollision ? "enabled" : "disabled"}).
                          </p>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer", marginBottom: 6 }}>
                            <input
                              type="checkbox"
                              checked={v.zInteraction ?? true}
                              onChange={(e) => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, zInteraction: e.target.checked } : vv))}
                            />
                            <span style={{ color: "#ffdd00" }}>Z-Interaction</span>
                          </label>
                          {(v.zInteraction ?? true) && !hasCollision && (
                            <ZInteractionEditor
                              zLine={v.zLine ?? zLine}
                              onZLineChange={(val) => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, zLine: val } : vv))}
                              tilesetSrc={v.tilesetSrc ?? tilesetSrc}
                              srcX={v.srcX}
                              srcY={v.srcY}
                              widthTiles={v.widthTiles ?? widthTiles}
                              heightTiles={v.heightTiles ?? heightTiles}
                            />
                          )}
                          {(v.zInteraction ?? true) && hasCollision && (
                            <p style={{ fontSize: 10, color: "#888", margin: 0 }}>
                              Z-line from collision center (<span style={{ color: "#ffdd00" }}>{Math.round((collision.y + collision.h / 2) * 100)}%</span>)
                            </p>
                          )}
                        </div>
                        {/* Mirror and Animation per variant */}
                        <div style={{ marginTop: 6, borderTop: "1px solid #2a2a3e", paddingTop: 6 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer", marginBottom: 6 }}>
                            <input
                              type="checkbox"
                              checked={v.horizontalFlip ?? false}
                              onChange={(e) => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, horizontalFlip: e.target.checked } : vv))}
                            />
                            <span>Mirror horizontally</span>
                          </label>
                          <div>
                            <label style={{ fontSize: 10, color: "#888", display: "block", marginBottom: 4 }}>Animation (override main)</label>
                            <select
                              style={{ ...inputStyle, cursor: "pointer", fontSize: 11 }}
                              value={v.animationId ?? ""}
                              onChange={(e) => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, animationId: e.target.value || null } : vv))}
                            >
                              <option value="">Inherit from main object</option>
                              <option value="-none-">None (static)</option>
                              {animations.map((anim) => (
                                <option key={anim.id} value={anim.id}>{anim.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {/* Pick from tileset grid */}
                        <details style={{ fontSize: 11, color: "#555", marginTop: 6 }}>
                          <summary style={{ cursor: "pointer", marginBottom: 4 }}>Pick from tileset</summary>
                          <TilesetGridPicker
                            src={v.tilesetSrc ?? tilesetSrc}
                            srcX={v.srcX}
                            srcY={v.srcY}
                            widthTiles={v.widthTiles ?? widthTiles}
                            heightTiles={v.heightTiles ?? heightTiles}
                            onSelect={(nx, ny) => setVariations((prev) => prev.map((vv, ii) => ii === i ? { ...vv, srcX: nx, srcY: ny } : vv))}
                          />
                        </details>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 4, gridColumn: "1 / -1" }}>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                style={{
                  ...btnStyle,
                  flex: 1,
                  background: selectedId ? "#f59e0b" : "#c084fc",
                  color: "#fff",
                  opacity: name.trim() ? 1 : 0.4,
                }}
              >
                {selectedId ? "Update Object" : "Create Object"}
              </button>
              {selectedId && (
                <button onClick={resetForm} style={{ ...btnStyle, background: "#333", color: "#aaa" }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
