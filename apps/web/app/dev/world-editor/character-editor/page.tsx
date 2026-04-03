"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { getUniqueTilesetSources, TILESET_TILE_SIZE } from "@mypixelpage/shared";
import type { AnimationDef, AnimationFrame } from "@mypixelpage/shared";
import { syncSettingToServer, loadSettingFromServer, autoHealSettings } from "@/lib/utils/dev-settings-sync";

const STORAGE_KEY = "dev-character-config";
const CUSTOM_SRC_KEY = "dev-custom-tileset-sources";
const ANIM_STORAGE_KEY = "dev-animations";

type Direction = "down" | "up" | "left" | "right" | "upRight" | "upLeft" | "downRight" | "downLeft";
type Motion = "idle" | "walk";

interface Clip {
  srcX: number;
  srcY: number;
  frameCount: number;
  frameDurationMs: number;
  /** When set, uses the AnimationDef from the Animation Editor instead of manual clip. */
  animationId?: string;
}

interface CharacterConfig {
  tilesetSrc: string;
  frameWidthTiles: number;
  frameHeightTiles: number;
  collision: { x: number; y: number; w: number; h: number };
  /** Normalized Y (0-1) of z-sorting line within the character sprite. 0=top, 1=bottom. */
  zLine: number;
  clips: Record<`${Motion}_${Direction}`, Clip>;
}

const DIRECTION_META: { key: Direction; label: string; required: boolean; icon: string }[] = [
  { key: "down", label: "Down", required: true, icon: "⬇️" },
  { key: "up", label: "Up", required: true, icon: "⬆️" },
  { key: "left", label: "Left", required: true, icon: "⬅️" },
  { key: "right", label: "Right", required: true, icon: "➡️" },
  { key: "downLeft", label: "Down Left", required: false, icon: "↙️" },
  { key: "downRight", label: "Down Right", required: false, icon: "↘️" },
  { key: "upLeft", label: "Up Left", required: false, icon: "↖️" },
  { key: "upRight", label: "Up Right", required: false, icon: "↗️" },
];

const MOTIONS: Motion[] = ["idle", "walk"];

const defaultClip = (x: number, y: number): Clip => ({
  srcX: x,
  srcY: y,
  frameCount: 1,
  frameDurationMs: 140,
});

// Sprout Lands Basic Character Spritesheet: 192×192, 48×48 frames (3×3 tiles)
// Row 0 (y=0):   walk down  (4 frames)
// Row 1 (y=48):  walk right (4 frames)
// Row 2 (y=96):  walk up    (4 frames)
// Row 3 (y=144): 4 more frames (unused/duplicate)
const DEFAULT_CONFIG: CharacterConfig = {
  tilesetSrc: "/tilesets/characters.png",
  frameWidthTiles: 3,
  frameHeightTiles: 3,
  collision: { x: 0.2, y: 0.5, w: 0.6, h: 0.45 },
  zLine: 0.95,
  clips: {
    idle_down:      { srcX: 0, srcY: 0,  frameCount: 1, frameDurationMs: 140 },
    idle_up:        { srcX: 0, srcY: 96, frameCount: 1, frameDurationMs: 140 },
    idle_left:      { srcX: 0, srcY: 48, frameCount: 1, frameDurationMs: 140 },
    idle_right:     { srcX: 0, srcY: 48, frameCount: 1, frameDurationMs: 140 },
    idle_downLeft:  { srcX: 0, srcY: 0,  frameCount: 1, frameDurationMs: 140 },
    idle_downRight: { srcX: 0, srcY: 0,  frameCount: 1, frameDurationMs: 140 },
    idle_upLeft:    { srcX: 0, srcY: 96, frameCount: 1, frameDurationMs: 140 },
    idle_upRight:   { srcX: 0, srcY: 96, frameCount: 1, frameDurationMs: 140 },
    walk_down:      { srcX: 0, srcY: 0,  frameCount: 4, frameDurationMs: 140 },
    walk_up:        { srcX: 0, srcY: 96, frameCount: 4, frameDurationMs: 140 },
    walk_left:      { srcX: 0, srcY: 48, frameCount: 4, frameDurationMs: 140 },
    walk_right:     { srcX: 0, srcY: 48, frameCount: 4, frameDurationMs: 140 },
    walk_downLeft:  { srcX: 0, srcY: 0,  frameCount: 4, frameDurationMs: 140 },
    walk_downRight: { srcX: 0, srcY: 0,  frameCount: 4, frameDurationMs: 140 },
    walk_upLeft:    { srcX: 0, srcY: 96, frameCount: 4, frameDurationMs: 140 },
    walk_upRight:   { srcX: 0, srcY: 96, frameCount: 4, frameDurationMs: 140 },
  },
};

function loadConfig(): CharacterConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as CharacterConfig | null;
    if (!parsed) return DEFAULT_CONFIG;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      collision: { ...DEFAULT_CONFIG.collision, ...parsed.collision },
      zLine: typeof parsed.zLine === "number" ? parsed.zLine : DEFAULT_CONFIG.zLine,
      clips: { ...DEFAULT_CONFIG.clips, ...parsed.clips },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function loadAnimationDefs(): AnimationDef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(ANIM_STORAGE_KEY) ?? "[]") as unknown[];
    return raw.filter((a): a is AnimationDef =>
      !!a && typeof a === "object" &&
      typeof (a as { id?: unknown }).id === "string" &&
      typeof (a as { name?: unknown }).name === "string" &&
      Array.isArray((a as { frames?: unknown }).frames)
    );
  } catch {
    return [];
  }
}

function labelForSource(src: string, index: number): string {
  if (src.startsWith("data:")) return `Uploaded Texture ${index + 1}`;
  const parts = src.split("/");
  return parts[parts.length - 1] || src;
}

// ── Spritesheet Preview Component ──
function SpritesheetPreview({
  src,
  frameW,
  frameH,
  selectedClip,
  onSelectFrame,
}: {
  src: string;
  frameW: number;
  frameH: number;
  selectedClip: Clip | null;
  onSelectFrame: (srcX: number, srcY: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ col: number; row: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const SCALE = 3;
  const pxW = frameW * TILESET_TILE_SIZE;
  const pxH = frameH * TILESET_TILE_SIZE;

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      imgRef.current = null;
      setImgSize({ w: 0, h: 0 });
    };
    img.src = src;
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || imgSize.w === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cols = Math.floor(imgSize.w / pxW);
    const rows = Math.floor(imgSize.h / pxH);
    canvas.width = cols * pxW * SCALE;
    canvas.height = rows * pxH * SCALE;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, cols * pxW, rows * pxH, 0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * pxW * SCALE, 0);
      ctx.lineTo(c * pxW * SCALE, canvas.height);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * pxH * SCALE);
      ctx.lineTo(canvas.width, r * pxH * SCALE);
      ctx.stroke();
    }

    // Highlight selected clip frames
    if (selectedClip) {
      const selCol = Math.floor(selectedClip.srcX / pxW);
      const selRow = Math.floor(selectedClip.srcY / pxH);
      ctx.fillStyle = "rgba(34, 197, 94, 0.25)";
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      for (let f = 0; f < selectedClip.frameCount; f++) {
        const fx = (selCol + f) * pxW * SCALE;
        const fy = selRow * pxH * SCALE;
        ctx.fillRect(fx, fy, pxW * SCALE, pxH * SCALE);
        ctx.strokeRect(fx, fy, pxW * SCALE, pxH * SCALE);
      }
    }

    // Hover highlight
    if (hover) {
      ctx.fillStyle = "rgba(147, 197, 253, 0.3)";
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 2;
      ctx.fillRect(hover.col * pxW * SCALE, hover.row * pxH * SCALE, pxW * SCALE, pxH * SCALE);
      ctx.strokeRect(hover.col * pxW * SCALE, hover.row * pxH * SCALE, pxW * SCALE, pxH * SCALE);
    }
  }, [imgSize, pxW, pxH, selectedClip, hover, SCALE]);

  const getCell = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || imgSize.w === 0) return null;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cellW = (pxW * SCALE * rect.width) / (canvasRef.current?.width ?? 1);
    const cellH = (pxH * SCALE * rect.height) / (canvasRef.current?.height ?? 1);
    return { col: Math.floor(x / cellW), row: Math.floor(y / cellH) };
  };

  if (imgSize.w === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 13 }}>
        No spritesheet loaded. Select or upload a tileset above.
      </div>
    );
  }

  return (
    <div style={{ overflow: "auto", maxHeight: 340, borderRadius: 8, border: "1px solid #29303a" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", cursor: "crosshair", imageRendering: "pixelated", maxWidth: "100%" }}
        onMouseMove={(e) => {
          const cell = getCell(e);
          setHover(cell);
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const cell = getCell(e);
          if (cell) onSelectFrame(cell.col * pxW, cell.row * pxH);
        }}
      />
    </div>
  );
}

// ── Animation Preview Component ──
function AnimationPreview({
  src,
  clip,
  frameW,
  frameH,
  collision,
  zLine,
}: {
  src: string;
  clip: Clip;
  frameW: number;
  frameH: number;
  collision: CharacterConfig["collision"];
  zLine?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const SCALE = 4;
  const pxW = frameW * TILESET_TILE_SIZE;
  const pxH = frameH * TILESET_TILE_SIZE;

  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setLoaded(true); };
    img.onerror = () => { imgRef.current = null; setLoaded(false); };
    img.src = src;
    return () => { setLoaded(false); };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !loaded) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = pxW * SCALE;
    canvas.height = pxH * SCALE;
    ctx.imageSmoothingEnabled = false;

    let frame = 0;
    let animId = 0;
    let lastTime = 0;
    let elapsed = 0;

    const draw = (time: number) => {
      const dt = lastTime ? time - lastTime : 0;
      lastTime = time;
      elapsed += dt;

      if (elapsed >= clip.frameDurationMs) {
        elapsed -= clip.frameDurationMs;
        frame = (frame + 1) % Math.max(1, clip.frameCount);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sx = clip.srcX + frame * pxW;
      const sy = clip.srcY;
      ctx.drawImage(img, sx, sy, pxW, pxH, 0, 0, canvas.width, canvas.height);

      // Draw collision box overlay
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        collision.x * canvas.width,
        collision.y * canvas.height,
        collision.w * canvas.width,
        collision.h * canvas.height
      );
      ctx.setLineDash([]);

      // Draw z-line overlay
      if (typeof zLine === "number") {
        const zy = zLine * canvas.height;
        ctx.strokeStyle = "#ffdd00";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(0, zy);
        ctx.lineTo(canvas.width, zy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [loaded, clip, pxW, pxH, collision, zLine, SCALE]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        imageRendering: "pixelated",
        width: pxW * SCALE,
        height: pxH * SCALE,
        borderRadius: 8,
        border: "1px solid #29303a",
        background: "#0b0e14",
      }}
    />
  );
}

// ── Animation Def Preview (uses AnimationDef frame-based data) ──
function AnimDefPreview({
  animDef,
  collision,
  zLine,
}: {
  animDef: AnimationDef;
  collision: CharacterConfig["collision"];
  zLine?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const SCALE = 4;

  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setLoaded(true); };
    img.onerror = () => { imgRef.current = null; setLoaded(false); };
    img.src = animDef.tilesetSrc;
    return () => { setLoaded(false); };
  }, [animDef.tilesetSrc]);

  const frames = animDef.frames;
  const frameW = (frames[0]?.widthTiles ?? 1) * TILESET_TILE_SIZE;
  const frameH = (frames[0]?.heightTiles ?? 1) * TILESET_TILE_SIZE;

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !loaded || frames.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = frameW * SCALE;
    canvas.height = frameH * SCALE;
    ctx.imageSmoothingEnabled = false;

    let frameIdx = 0;
    let animId = 0;
    let lastTime = 0;
    let elapsed = 0;

    const draw = (time: number) => {
      const dt = lastTime ? time - lastTime : 0;
      lastTime = time;
      elapsed += dt;

      const curFrame = frames[frameIdx];
      if (curFrame && elapsed >= curFrame.durationMs) {
        elapsed -= curFrame.durationMs;
        frameIdx = (frameIdx + 1) % frames.length;
      }

      const f = frames[frameIdx];
      if (!f) { animId = requestAnimationFrame(draw); return; }

      const fw = (f.widthTiles ?? 1) * TILESET_TILE_SIZE;
      const fh = (f.heightTiles ?? 1) * TILESET_TILE_SIZE;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, f.srcX, f.srcY, fw, fh, 0, 0, canvas.width, canvas.height);

      // Draw collision box
      ctx.strokeStyle = "#f87171";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        collision.x * canvas.width,
        collision.y * canvas.height,
        collision.w * canvas.width,
        collision.h * canvas.height
      );
      ctx.setLineDash([]);

      // Draw z-line overlay
      if (typeof zLine === "number") {
        const zy = zLine * canvas.height;
        ctx.strokeStyle = "#ffdd00";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(0, zy);
        ctx.lineTo(canvas.width, zy);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animId = requestAnimationFrame(draw);
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [loaded, frames, frameW, frameH, collision, zLine, SCALE]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        imageRendering: "pixelated",
        width: frameW * SCALE,
        height: frameH * SCALE,
        borderRadius: 8,
        border: "1px solid #29303a",
        background: "#0b0e14",
      }}
    />
  );
}

// ── Clip Card Component ──
function ClipCard({
  motion,
  direction,
  clip,
  tilesetSrc,
  frameW,
  frameH,
  collision,
  zLine,
  animationDefs,
  onUpdate,
  isActive,
  onActivate,
}: {
  motion: Motion;
  direction: Direction;
  clip: Clip;
  tilesetSrc: string;
  frameW: number;
  frameH: number;
  collision: CharacterConfig["collision"];
  zLine?: number;
  animationDefs: AnimationDef[];
  onUpdate: (patch: Partial<Clip>) => void;
  isActive: boolean;
  onActivate: () => void;
}) {
  const meta = DIRECTION_META.find((d) => d.key === direction)!;
  const linkedAnim = clip.animationId
    ? animationDefs.find((a) => a.id === clip.animationId) ?? null
    : null;

  const inputStyle: React.CSSProperties = {
    background: "#1a1f2e",
    border: "1px solid #374151",
    color: "#e5e7eb",
    borderRadius: 6,
    padding: "4px 6px",
    fontSize: 11,
    width: "100%",
  };

  return (
    <div
      onClick={onActivate}
      style={{
        border: isActive ? "2px solid #22c55e" : "1px solid #29303a",
        borderRadius: 10,
        padding: 10,
        background: isActive ? "#111827" : "#0f1319",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {linkedAnim ? (
          <AnimDefPreview animDef={linkedAnim} collision={collision} zLine={zLine} />
        ) : (
          <AnimationPreview
            src={tilesetSrc}
            clip={clip}
            frameW={frameW}
            frameH={frameH}
            collision={collision}
            zLine={zLine}
          />
        )}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f4f6" }}>
            {meta.icon} {motion === "idle" ? "Idle" : "Walk"} {meta.label}
          </div>
          <div style={{ fontSize: 10, color: meta.required ? "#fca5a5" : "#93c5fd", marginTop: 2 }}>
            {meta.required ? "Required" : "Optional"}
          </div>
          {linkedAnim && (
            <div style={{ fontSize: 10, color: "#a78bfa", marginTop: 2 }}>
              🎬 {linkedAnim.name} ({linkedAnim.frames.length} frames)
            </div>
          )}
        </div>
      </div>

      {/* Animation source selector */}
      <div onClick={(e) => e.stopPropagation()} style={{ marginBottom: 6 }}>
        <select
          value={clip.animationId ?? "__manual__"}
          style={{ ...inputStyle, width: "100%", cursor: "pointer" }}
          onChange={(e) => {
            const val = e.target.value;
            if (val === "__manual__") {
              onUpdate({ animationId: undefined });
            } else {
              onUpdate({ animationId: val });
            }
          }}
        >
          <option value="__manual__">Manual clip</option>
          {animationDefs.map((a) => (
            <option key={a.id} value={a.id}>
              🎬 {a.name} ({a.frames.length} frames)
            </option>
          ))}
        </select>
      </div>

      {/* Manual clip params — only shown when not linked to animation */}
      {!linkedAnim && (
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <label style={{ fontSize: 10, color: "#6b7280" }}>
            X<input type="number" value={clip.srcX} style={inputStyle} onChange={(e) => onUpdate({ srcX: Number(e.target.value) || 0 })} />
          </label>
          <label style={{ fontSize: 10, color: "#6b7280" }}>
            Y<input type="number" value={clip.srcY} style={inputStyle} onChange={(e) => onUpdate({ srcY: Number(e.target.value) || 0 })} />
          </label>
          <label style={{ fontSize: 10, color: "#6b7280" }}>
            Frames<input type="number" min={1} value={clip.frameCount} style={inputStyle} onChange={(e) => onUpdate({ frameCount: Math.max(1, Number(e.target.value) || 1) })} />
          </label>
          <label style={{ fontSize: 10, color: "#6b7280" }}>
            ms<input type="number" min={16} value={clip.frameDurationMs} style={inputStyle} onChange={(e) => onUpdate({ frameDurationMs: Math.max(16, Number(e.target.value) || 16) })} />
          </label>
        </div>
      )}
    </div>
  );
}

// ── Collision Box Visual Editor ──
function CollisionEditor({
  collision,
  onChange,
}: {
  collision: CharacterConfig["collision"];
  onChange: (c: CharacterConfig["collision"]) => void;
}) {
  const SIZE = 120;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Character silhouette
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.ellipse(SIZE / 2, SIZE * 0.35, SIZE * 0.25, SIZE * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(SIZE * 0.35, SIZE * 0.35, SIZE * 0.3, SIZE * 0.45);

    // Collision box
    ctx.strokeStyle = "#f87171";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(collision.x * SIZE, collision.y * SIZE, collision.w * SIZE, collision.h * SIZE);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(248, 113, 113, 0.15)";
    ctx.fillRect(collision.x * SIZE, collision.y * SIZE, collision.w * SIZE, collision.h * SIZE);

    // Resize handles
    const handles = [
      { cx: collision.x * SIZE, cy: collision.y * SIZE },
      { cx: (collision.x + collision.w) * SIZE, cy: collision.y * SIZE },
      { cx: collision.x * SIZE, cy: (collision.y + collision.h) * SIZE },
      { cx: (collision.x + collision.w) * SIZE, cy: (collision.y + collision.h) * SIZE },
    ];
    ctx.fillStyle = "#f87171";
    for (const h of handles) {
      ctx.beginPath();
      ctx.arc(h.cx, h.cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [collision]);

  const handleDrag = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragging.current) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      if (dragging.current === "move") {
        const w = collision.w;
        const h = collision.h;
        onChange({
          ...collision,
          x: Math.max(0, Math.min(1 - w, nx - w / 2)),
          y: Math.max(0, Math.min(1 - h, ny - h / 2)),
        });
      } else if (dragging.current === "br") {
        onChange({
          ...collision,
          w: Math.max(0.05, Math.min(1 - collision.x, nx - collision.x)),
          h: Math.max(0.05, Math.min(1 - collision.y, ny - collision.y)),
        });
      }
    },
    [collision, onChange]
  );

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{ borderRadius: 8, border: "1px solid #29303a", cursor: "move", display: "block" }}
      onMouseDown={(e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;
        const brX = collision.x + collision.w;
        const brY = collision.y + collision.h;
        if (Math.abs(mx - brX) < 0.08 && Math.abs(my - brY) < 0.08) {
          dragging.current = "br";
        } else {
          dragging.current = "move";
        }
      }}
      onMouseMove={handleDrag}
      onMouseUp={() => { dragging.current = null; }}
      onMouseLeave={() => { dragging.current = null; }}
    />
  );
}

// ── Character Z-Line Visual Editor ──
function CharacterZLineEditor({
  zLine,
  onChange,
  collision,
}: {
  zLine: number;
  onChange: (v: number) => void;
  collision: CharacterConfig["collision"];
}) {
  const SIZE = 120;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Character silhouette
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.ellipse(SIZE / 2, SIZE * 0.35, SIZE * 0.25, SIZE * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(SIZE * 0.35, SIZE * 0.35, SIZE * 0.3, SIZE * 0.45);

    // Collision box (faint)
    ctx.strokeStyle = "rgba(248, 113, 113, 0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(collision.x * SIZE, collision.y * SIZE, collision.w * SIZE, collision.h * SIZE);
    ctx.setLineDash([]);

    // Z-line
    const lineY = zLine * SIZE;
    ctx.strokeStyle = "#ffdd00";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(SIZE, lineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Handle
    ctx.fillStyle = "#ffdd00";
    ctx.fillRect(SIZE / 2 - 12, lineY - 3, 24, 6);

    // Labels
    ctx.font = "bold 9px monospace";
    ctx.fillStyle = "#ffdd00";
    ctx.fillText("BEHIND", 2, Math.max(10, lineY - 4));
    ctx.fillText("IN FRONT", 2, Math.min(SIZE - 2, lineY + 12));
  }, [zLine, collision]);

  const getY = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return zLine;
    return Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
  }, [zLine]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE}
      height={SIZE}
      style={{ borderRadius: 8, border: "1px solid #29303a", cursor: "ns-resize", display: "block" }}
      onMouseDown={(e) => {
        const y = getY(e);
        if (Math.abs(y - zLine) < 0.1) {
          dragging.current = true;
        }
      }}
      onMouseMove={(e) => {
        if (!dragging.current) return;
        onChange(Math.round(getY(e) * 100) / 100);
      }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
    />
  );
}

// ── Main Page ──
export default function CharacterEditorPage() {
  const [config, setConfig] = useState<CharacterConfig>(DEFAULT_CONFIG);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [activeClip, setActiveClip] = useState<`${Motion}_${Direction}`>("idle_down");
  const [activeTab, setActiveTab] = useState<"idle" | "walk">("idle");
  const [animationDefs, setAnimationDefs] = useState<AnimationDef[]>([]);

  useEffect(() => {
    Promise.all([
      loadSettingFromServer("dev-character-config"),
      loadSettingFromServer("dev-animations"),
      loadSettingFromServer("dev-custom-tileset-sources"),
    ]).then(([serverConfig, serverAnims, serverSrcs]) => {
      const loaded = loadConfig();
      setConfig(loaded);
      setAnimationDefs(loadAnimationDefs());
      let custom: string[] = [];
      try {
        const parsed = JSON.parse(localStorage.getItem(CUSTOM_SRC_KEY) ?? "[]") as unknown[];
        custom = parsed.filter((src): src is string => typeof src === "string" && src.length > 0);
      } catch { custom = []; }
      setSourceOptions(
        Array.from(new Set([...getUniqueTilesetSources(), ...custom, loaded.tilesetSrc])).filter(
          (src): src is string => typeof src === "string" && src.length > 0
        )
      );
      autoHealSettings([["dev-character-config", serverConfig], ["dev-animations", serverAnims], ["dev-custom-tileset-sources", serverSrcs]]);
    });
  }, []);

  const updateClip = (key: `${Motion}_${Direction}`, patch: Partial<Clip>) => {
    setConfig((prev) => ({
      ...prev,
      clips: { ...prev.clips, [key]: { ...prev.clips[key], ...patch } },
    }));
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    syncSettingToServer(STORAGE_KEY, JSON.stringify(config));
    setSavedAt(new Date());
  };

  const onUploadTexture = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setConfig((prev) => ({ ...prev, tilesetSrc: result }));
      setSourceOptions((prev) => {
        const next = prev.includes(result) ? prev : [...prev, result];
        try {
          const parsed = JSON.parse(localStorage.getItem(CUSTOM_SRC_KEY) ?? "[]") as unknown[];
          const custom = parsed.filter((src): src is string => typeof src === "string" && src.length > 0);
          const merged = custom.includes(result) ? custom : [...custom, result];
          localStorage.setItem(CUSTOM_SRC_KEY, JSON.stringify(merged));
          syncSettingToServer(CUSTOM_SRC_KEY, JSON.stringify(merged));
        } catch {
          localStorage.setItem(CUSTOM_SRC_KEY, JSON.stringify([result]));
          syncSettingToServer(CUSTOM_SRC_KEY, JSON.stringify([result]));
        }
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const inputStyle: React.CSSProperties = {
    background: "#1a1f2e",
    border: "1px solid #374151",
    color: "#e5e7eb",
    borderRadius: 6,
    padding: "6px 8px",
    fontSize: 12,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0d12", color: "#e5e7eb", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e2533", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/dev/world-editor" style={{ color: "#6b7280", textDecoration: "none", fontSize: 20 }}>←</a>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Character Editor</h1>
            <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>Configure spritesheet, collision box, and animation clips</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {savedAt && <span style={{ color: "#86efac", fontSize: 11 }}>Saved {savedAt.toLocaleTimeString()}</span>}
          <button onClick={save} style={{
            border: "none", background: "#22c55e", color: "#052e16", fontWeight: 700,
            borderRadius: 8, padding: "8px 20px", cursor: "pointer", fontSize: 13,
          }}>
            Save
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 0, height: "calc(100vh - 60px)" }}>
        {/* ── Left: Settings & Spritesheet ── */}
        <div style={{ borderRight: "1px solid #1e2533", padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Tileset source */}
          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>Spritesheet</h3>
            <select value={config.tilesetSrc} style={{ ...inputStyle, width: "100%" }} onChange={(e) => setConfig((p) => ({ ...p, tilesetSrc: e.target.value }))}>
              {sourceOptions.map((src, idx) => (
                <option key={src} value={src}>{labelForSource(src, idx)}</option>
              ))}
            </select>
            <label style={{ display: "block", marginTop: 8, fontSize: 11, color: "#6b7280", cursor: "pointer" }}>
              Upload PNG
              <input type="file" accept="image/png,image/webp" style={{ display: "none" }} onChange={(e) => onUploadTexture(e.target.files?.[0] ?? null)} />
              <span style={{ display: "inline-block", marginLeft: 8, padding: "3px 10px", background: "#1f2937", borderRadius: 6, color: "#93c5fd", fontSize: 11 }}>
                Choose File
              </span>
            </label>
          </section>

          {/* Frame size */}
          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>Frame Size</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label style={{ fontSize: 11, color: "#6b7280" }}>
                Width (tiles)
                <input type="number" min={1} value={config.frameWidthTiles} style={{ ...inputStyle, width: "100%", marginTop: 4 }}
                  onChange={(e) => setConfig((p) => ({ ...p, frameWidthTiles: Math.max(1, Number(e.target.value) || 1) }))} />
              </label>
              <label style={{ fontSize: 11, color: "#6b7280" }}>
                Height (tiles)
                <input type="number" min={1} value={config.frameHeightTiles} style={{ ...inputStyle, width: "100%", marginTop: 4 }}
                  onChange={(e) => setConfig((p) => ({ ...p, frameHeightTiles: Math.max(1, Number(e.target.value) || 1) }))} />
              </label>
            </div>
          </section>

          {/* Collision box */}
          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>Collision Box</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <CollisionEditor
                collision={config.collision}
                onChange={(c) => setConfig((p) => ({ ...p, collision: c }))}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, flex: 1 }}>
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <label key={k} style={{ fontSize: 10, color: "#6b7280" }}>
                    {k.toUpperCase()}
                    <input type="number" min={0} max={1} step={0.05} value={config.collision[k]}
                      style={{ ...inputStyle, width: "100%", marginTop: 2, fontSize: 11, padding: "3px 5px" }}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        const v = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
                        setConfig((p) => ({ ...p, collision: { ...p.collision, [k]: v } }));
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>Drag to move · Drag bottom-right handle to resize</div>
          </section>

          {/* Z-Interaction Line */}
          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>Z-Interaction Line</h3>
            <p style={{ fontSize: 10, color: "#4b5563", margin: "0 0 8px" }}>
              Drag the yellow line to set where the character sorts against objects. Usually near the feet.
            </p>
            <CharacterZLineEditor
              zLine={config.zLine}
              onChange={(v) => setConfig((p) => ({ ...p, zLine: v }))}
              collision={config.collision}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <label style={{ fontSize: 10, color: "#6b7280" }}>Y</label>
              <input type="number" min={0} max={100} step={1}
                value={Math.round(config.zLine * 100)}
                style={{ ...inputStyle, width: 60, fontSize: 11, padding: "3px 6px" }}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                  setConfig((p) => ({ ...p, zLine: v / 100 }));
                }}
              />
              <span style={{ fontSize: 10, color: "#4b5563" }}>% (0 = top, 100 = bottom)</span>
            </div>
          </section>

          {/* Spritesheet preview */}
          <section style={{ flex: 1 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1 }}>
              Spritesheet Preview
            </h3>
            <div style={{ fontSize: 10, color: "#4b5563", marginBottom: 6 }}>
              Click a cell to set the active clip&apos;s position. Green = selected clip frames.
            </div>
            <SpritesheetPreview
              src={config.tilesetSrc}
              frameW={config.frameWidthTiles}
              frameH={config.frameHeightTiles}
              selectedClip={config.clips[activeClip]}
              onSelectFrame={(srcX, srcY) => updateClip(activeClip, { srcX, srcY })}
            />
          </section>
        </div>

        {/* ── Right: Animation Clips ── */}
        <div style={{ padding: 16, overflowY: "auto" }}>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0, marginBottom: 16 }}>
            {(["idle", "walk"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  background: activeTab === tab ? "#1e293b" : "transparent",
                  border: "1px solid #29303a",
                  borderBottom: activeTab === tab ? "2px solid #22c55e" : "1px solid #29303a",
                  color: activeTab === tab ? "#f3f4f6" : "#6b7280",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {tab === "idle" ? "🧍 Idle" : "🏃 Walk"}
              </button>
            ))}
          </div>

          {/* Direction clip cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {DIRECTION_META.map((d) => {
              const key = `${activeTab}_${d.key}` as const;
              return (
                <ClipCard
                  key={key}
                  motion={activeTab}
                  direction={d.key}
                  clip={config.clips[key]}
                  tilesetSrc={config.tilesetSrc}
                  frameW={config.frameWidthTiles}
                  frameH={config.frameHeightTiles}
                  collision={config.collision}
                  zLine={config.zLine}
                  animationDefs={animationDefs}
                  onUpdate={(patch) => updateClip(key, patch)}
                  isActive={activeClip === key}
                  onActivate={() => setActiveClip(key)}
                />
              );
            })}
          </div>

          {/* Help text */}
          <div style={{ marginTop: 16, padding: 12, background: "#111827", border: "1px solid #1e293b", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
              <strong style={{ color: "#9ca3af" }}>How to use:</strong><br />
              1. Select or upload your character spritesheet above<br />
              2. Set frame size (how many tiles wide/tall each frame is)<br />
              3. Click a clip card to select it (green border), then click the spritesheet preview to set its position<br />
              4. Use the dropdown on each clip to pick an animation from the <strong>Animation Editor</strong>, or configure manually<br />
              5. Drag the collision box to set the character&apos;s hitbox<br />
              6. Click <strong>Save</strong> — the config is used in the editor&apos;s Play mode
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
