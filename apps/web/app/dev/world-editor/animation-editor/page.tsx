"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { TILESET_TILE_SIZE, getUniqueTilesetSources } from "@mypixelpage/shared";
import type { AnimationDef, AnimationFrame } from "@mypixelpage/shared";
import { syncSettingToServer, loadSettingFromServer, autoHealSettings } from "@/lib/utils/dev-settings-sync";
import { useNotify } from "@/components/notifications";

/* ── Constants ──────────────────────────────────── */
const STORAGE_KEY = "dev-animations";
const CUSTOM_SRC_KEY = "dev-custom-tileset-sources";
const SCALE = 3;
const CELL_PX = TILESET_TILE_SIZE * SCALE;
const DEFAULT_FRAME_MS = 200;

/* ── Persistence ────────────────────────────────── */
function loadAnimations(): AnimationDef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAnimations(anims: AnimationDef[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(anims));
  syncSettingToServer(STORAGE_KEY, JSON.stringify(anims));
}

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
  padding: 20,
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "#2a2a3e",
  border: "1px solid #444",
  borderRadius: 6,
  padding: "6px 10px",
  color: "#e0e0e0",
  fontSize: 13,
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

/* ── Tileset grid picker ────────────────────────── */
function TilesetPicker({
  src,
  onPick,
  onRemoveAt,
  pickWidthTiles,
  pickHeightTiles,
  pickSrcX,
  pickSrcY,
  selectedFrames,
}: {
  src: string;
  onPick: (srcX: number, srcY: number) => void;
  onRemoveAt: (srcX: number, srcY: number) => void;
  pickWidthTiles: number;
  pickHeightTiles: number;
  pickSrcX: number;
  pickSrcY: number;
  selectedFrames: AnimationFrame[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = src;
  }, [src]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !img) return;
    const w = img.width * SCALE;
    const h = img.height * SCALE;
    cvs.width = w;
    cvs.height = h;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, w, h);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += CELL_PX) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += CELL_PX) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Highlight selected frames
    selectedFrames.forEach((f, i) => {
      const px = (f.srcX / TILESET_TILE_SIZE) * CELL_PX;
      const py = (f.srcY / TILESET_TILE_SIZE) * CELL_PX;
      const frameW = (f.widthTiles ?? 1) * CELL_PX;
      const frameH = (f.heightTiles ?? 1) * CELL_PX;
      ctx.strokeStyle = "#ffdd00";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, frameW - 2, frameH - 2);
      ctx.fillStyle = "rgba(255,221,0,0.12)";
      ctx.fillRect(px, py, frameW, frameH);
      ctx.fillStyle = "#ffdd00";
      ctx.font = "bold 12px monospace";
      ctx.fillText(`${i + 1}`, px + 3, py + 13);
    });

    // Preview rectangle for the next picked frame size/position
    const pickCol = Math.floor(pickSrcX / TILESET_TILE_SIZE);
    const pickRow = Math.floor(pickSrcY / TILESET_TILE_SIZE);
    const pickPx = pickCol * CELL_PX;
    const pickPy = pickRow * CELL_PX;
    const pickW = pickWidthTiles * CELL_PX;
    const pickH = pickHeightTiles * CELL_PX;

    ctx.fillStyle = "rgba(79,195,247,0.18)";
    ctx.fillRect(pickPx, pickPy, pickW, pickH);
    ctx.strokeStyle = "rgba(79,195,247,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      pickPx + 1,
      pickPy + 1,
      pickW - 2,
      pickH - 2,
    );
    ctx.fillStyle = "rgba(79,195,247,0.95)";
    ctx.font = "bold 11px monospace";
    ctx.fillText("NEXT", pickPx + 4, pickPy + 12);
  }, [img, pickHeightTiles, pickWidthTiles, pickSrcX, pickSrcY, selectedFrames]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const cvs = canvasRef.current;
      if (!cvs || !img) return;
      const rect = cvs.getBoundingClientRect();
      const scaleX = cvs.width / rect.width;
      const scaleY = cvs.height / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      const col = Math.floor(px / CELL_PX);
      const row = Math.floor(py / CELL_PX);
      onPick(col * TILESET_TILE_SIZE, row * TILESET_TILE_SIZE);
    },
    [img, onPick],
  );

  const handleRightClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const cvs = canvasRef.current;
      if (!cvs || !img) return;
      const rect = cvs.getBoundingClientRect();
      const scaleX = cvs.width / rect.width;
      const scaleY = cvs.height / rect.height;
      const px = (e.clientX - rect.left) * scaleX;
      const py = (e.clientY - rect.top) * scaleY;
      const col = Math.floor(px / CELL_PX);
      const row = Math.floor(py / CELL_PX);
      onRemoveAt(col * TILESET_TILE_SIZE, row * TILESET_TILE_SIZE);
    },
    [img, onRemoveAt],
  );

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onContextMenu={handleRightClick}
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

/* ── Animation preview ──────────────────────────── */
function AnimationPreview({
  anim,
  size = 64,
}: {
  anim: AnimationDef;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const frameIdx = useRef(0);

  useEffect(() => {
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = anim.tilesetSrc;
  }, [anim.tilesetSrc]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || !img || anim.frames.length === 0) return;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    frameIdx.current = 0;

    let timer: ReturnType<typeof setTimeout>;
    const draw = () => {
      const f = anim.frames[frameIdx.current]!;
      const frameWidthTiles = f.widthTiles ?? 1;
      const frameHeightTiles = f.heightTiles ?? 1;
      const sw = frameWidthTiles * TILESET_TILE_SIZE;
      const sh = frameHeightTiles * TILESET_TILE_SIZE;
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
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      if (f.horizontalFlip) {
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(
        img,
        f.srcX, f.srcY, sw, sh,
        dx, dy, dw, dh,
      );
      ctx.restore();
      if (anim.frames.length > 1) {
        const nextIdx = anim.loop
          ? (frameIdx.current + 1) % anim.frames.length
          : Math.min(frameIdx.current + 1, anim.frames.length - 1);
        if (nextIdx !== frameIdx.current || anim.loop) {
          frameIdx.current = nextIdx;
          timer = setTimeout(draw, f.durationMs);
        }
      }
    };
    draw();
    return () => clearTimeout(timer);
  }, [img, anim, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ borderRadius: 4, imageRendering: "pixelated", border: "1px solid #444", background: "#0a0a0a" }}
    />
  );
}

/* ── Main page ──────────────────────────────────── */
export default function AnimationEditorPage() {
  const [animations, setAnimations] = useState<AnimationDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tilesetSrc, setTilesetSrc] = useState(getUniqueTilesetSources()[0] ?? "");
  const [frames, setFrames] = useState<AnimationFrame[]>([]);
  const [loop, setLoop] = useState(true);
  const [frameDuration, setFrameDuration] = useState(DEFAULT_FRAME_MS);
  const [frameWidthTiles, setFrameWidthTiles] = useState(1);
  const [frameHeightTiles, setFrameHeightTiles] = useState(1);
  const [pickSrcX, setPickSrcX] = useState(0);
  const [pickSrcY, setPickSrcY] = useState(0);
  const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { confirm } = useNotify();

  useEffect(() => {
    Promise.all([
      loadSettingFromServer("dev-animations"),
      loadSettingFromServer("dev-custom-tileset-sources"),
    ]).then(([serverAnims, serverSrcs]) => {
      setAnimations(loadAnimations());
      const persisted = loadCustomSources();
      const fromAnims = loadAnimations().map((a) => a.tilesetSrc).filter(Boolean);
      const builtIn = new Set(getUniqueTilesetSources());
      const merged = [...new Set([...persisted, ...fromAnims])].filter((s) => !builtIn.has(s));
      setCustomSources(merged);
      autoHealSettings([["dev-animations", serverAnims], ["dev-custom-tileset-sources", serverSrcs]]);
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

  const handlePickFrame = useCallback(
    (srcX: number, srcY: number) => {
      setPickSrcX(srcX);
      setPickSrcY(srcY);
      setPreviewFrameIdx(frames.length);
      setFrames((prev) => [
        ...prev,
        {
          srcX,
          srcY,
          widthTiles: frameWidthTiles,
          heightTiles: frameHeightTiles,
          durationMs: frameDuration,
        },
      ]);
    },
    [frameDuration, frameHeightTiles, frameWidthTiles, frames.length],
  );

  const handleAddFrameFromFineTune = useCallback(() => {
    handlePickFrame(pickSrcX, pickSrcY);
  }, [handlePickFrame, pickSrcX, pickSrcY]);

  const handleApplyFineTuneToSelectedFrame = useCallback(() => {
    setFrames((prev) => {
      if (prev.length === 0) return prev;
      const idx = Math.min(Math.max(0, previewFrameIdx), prev.length - 1);
      return prev.map((f, i) =>
        i === idx
          ? {
              ...f,
              srcX: pickSrcX,
              srcY: pickSrcY,
              widthTiles: frameWidthTiles,
              heightTiles: frameHeightTiles,
            }
          : f,
      );
    });
  }, [previewFrameIdx, pickSrcX, pickSrcY, frameWidthTiles, frameHeightTiles]);

  const handleRemoveFrame = useCallback((idx: number) => {
    setFrames((prev) => prev.filter((_, i) => i !== idx));
    setPreviewFrameIdx((prev) => Math.max(0, prev > idx ? prev - 1 : prev));
  }, []);

  const handleDuplicateFrame = useCallback((idx: number) => {
    setFrames((prev) => {
      const clone = { ...prev[idx]! };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    setPreviewFrameIdx(idx + 1);
  }, []);

  const handleRemoveFrameAt = useCallback((srcX: number, srcY: number) => {
    setFrames((prev) => {
      // Remove the latest frame whose selected area contains the clicked cell.
      for (let i = prev.length - 1; i >= 0; i--) {
        const f = prev[i]!;
        const fx1 = f.srcX;
        const fy1 = f.srcY;
        const fx2 = fx1 + (f.widthTiles ?? 1) * TILESET_TILE_SIZE;
        const fy2 = fy1 + (f.heightTiles ?? 1) * TILESET_TILE_SIZE;
        if (srcX >= fx1 && srcX < fx2 && srcY >= fy1 && srcY < fy2) {
          return prev.filter((_, idx) => idx !== i);
        }
      }
      return prev;
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim() || frames.length === 0) return;
    const id = selectedId ?? `anim_${Date.now()}`;
    const anim: AnimationDef = {
      id,
      name: name.trim(),
      tilesetSrc,
      frames: [...frames],
      loop,
    };
    const updated = selectedId
      ? animations.map((a) => (a.id === selectedId ? anim : a))
      : [...animations, anim];
    setAnimations(updated);
    saveAnimations(updated);
    resetForm();
  }, [
    name,
    tilesetSrc,
    frames,
    loop,
    selectedId,
    animations,
  ]);

  const handleEdit = useCallback((anim: AnimationDef) => {
    setSelectedId(anim.id);
    setName(anim.name);
    setTilesetSrc(anim.tilesetSrc);
    setFrames([...anim.frames]);
    setPreviewFrameIdx(0);
    if (anim.frames[0]) {
      setPickSrcX(anim.frames[0].srcX);
      setPickSrcY(anim.frames[0].srcY);
    }
    setLoop(anim.loop);
    setFrameDuration(anim.frames[0]?.durationMs ?? DEFAULT_FRAME_MS);
    setFrameWidthTiles(anim.frames[0]?.widthTiles ?? 1);
    setFrameHeightTiles(anim.frames[0]?.heightTiles ?? 1);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      const anim = animations.find((a) => a.id === id);
      confirm(
        `Delete animation "${anim?.name || id}"? This cannot be undone.`,
        () => {
          const updated = animations.filter((a) => a.id !== id);
          setAnimations(updated);
          saveAnimations(updated);
          if (selectedId === id) resetForm();
        },
        { title: "Delete Animation", confirmText: "Delete", cancelText: "Cancel" },
      );
    },
    [animations, selectedId, confirm],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const anim = animations.find((a) => a.id === id);
      if (!anim) return;
      const dup: AnimationDef = {
        ...anim,
        id: `anim_${Date.now()}`,
        name: `${anim.name} (copy)`,
        frames: anim.frames.map((f) => ({ ...f })),
      };
      const updated = [...animations, dup];
      setAnimations(updated);
      saveAnimations(updated);
    },
    [animations],
  );

  const resetForm = () => {
    setSelectedId(null);
    setName("");
    setFrames([]);
    setLoop(true);
    setFrameDuration(DEFAULT_FRAME_MS);
    setFrameWidthTiles(1);
    setFrameHeightTiles(1);
    setPickSrcX(0);
    setPickSrcY(0);
    setPreviewFrameIdx(0);
  };

  // Preview for current editing state.
  // If no frames have been added yet, preview the fine-tuned "next frame"
  // so the right-side card always reflects the actual output window.
  const previewFrames: AnimationFrame[] =
    frames.length > 0
      ? frames.map((f, i) => {
          const idx = Math.min(Math.max(0, previewFrameIdx), frames.length - 1);
          if (i !== idx) return f;
          return {
            ...f,
            srcX: pickSrcX,
            srcY: pickSrcY,
            widthTiles: frameWidthTiles,
            heightTiles: frameHeightTiles,
          };
        })
      : [{
          srcX: pickSrcX,
          srcY: pickSrcY,
          widthTiles: frameWidthTiles,
          heightTiles: frameHeightTiles,
          durationMs: frameDuration,
        }];
  const previewAnim: AnimationDef = {
    id: "preview",
    name: "preview",
    tilesetSrc,
    frames: previewFrames,
    loop,
  };

  return (
    <div style={pageBg}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>Animation Editor</h1>
          <p style={{ color: "#888", fontSize: 13, margin: "4px 0 0" }}>
            Create frame-based animations. Click tileset cells to add frames. Link animations to tiles/objects.
          </p>
        </div>
        <a href="/dev/world-editor" style={{ ...btnStyle, background: "#333", color: "#ccc", textDecoration: "none" }}>
          ← Dev Tiles
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        {/* LEFT: Tileset picker + frame list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Tileset selector */}
          <div style={cardStyle}>
            <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 6 }}>Tileset Source</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {tilesetSources.map((src) => (
                <button
                  key={src}
                  onClick={() => setTilesetSrc(src)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    border: tilesetSrc === src ? "2px solid #ffdd00" : "1px solid #444",
                    background: tilesetSrc === src ? "#2a2a4e" : "#1a1a2e",
                    color: "#e0e0e0",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: tilesetSrc === src ? 700 : 400,
                  }}
                >
                  {src.split("/").pop()}
                </button>
              ))}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png"
                onChange={handleUploadTexture}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: "6px 14px",
                  borderRadius: 8,
                  border: "1px dashed #666",
                  background: "#1a1a2e",
                  color: "#888",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                + Upload PNG
              </button>
              {uploadStatus && (
                <span style={{ fontSize: 11, color: "#888", alignSelf: "center" }}>{uploadStatus}</span>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  New Frame Width (tiles)
                </label>
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  max={8}
                  value={frameWidthTiles}
                  onChange={(e) => setFrameWidthTiles(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  New Frame Height (tiles)
                </label>
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  max={8}
                  value={frameHeightTiles}
                  onChange={(e) => setFrameHeightTiles(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
            </div>
            <details style={{ fontSize: 11, color: "#555", marginBottom: 12 }}>
              <summary style={{ cursor: "pointer", marginBottom: 6 }}>Fine-tune next frame position (px)</summary>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8, alignItems: "end" }}>
                <div>
                  <label style={{ fontSize: 10, color: "#666" }}>srcX</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    value={pickSrcX}
                    onChange={(e) => setPickSrcX(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#666" }}>srcY</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    value={pickSrcY}
                    onChange={(e) => setPickSrcY(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  />
                </div>
                <button
                  onClick={handleAddFrameFromFineTune}
                  style={{ ...btnStyle, padding: "6px 10px", background: "#2563eb", color: "#fff", fontSize: 11 }}
                  title="Add a frame from the fine-tuned source coordinates"
                >
                  + Add
                </button>
                <button
                  onClick={handleApplyFineTuneToSelectedFrame}
                  disabled={frames.length === 0}
                  style={{
                    ...btnStyle,
                    padding: "6px 10px",
                    background: frames.length > 0 ? "#0ea5a4" : "#555",
                    color: "#fff",
                    fontSize: 11,
                    opacity: frames.length > 0 ? 1 : 0.5,
                  }}
                  title="Apply fine-tune values to the selected frame"
                >
                  Apply
                </button>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: "#777", minWidth: 82 }}>Next frame:</span>
                <FramePreview
                  src={tilesetSrc}
                  frame={{
                    srcX: pickSrcX,
                    srcY: pickSrcY,
                    widthTiles: frameWidthTiles,
                    heightTiles: frameHeightTiles,
                    durationMs: frameDuration,
                  }}
                />
                <span style={{ fontSize: 10, color: "#666" }}>
                  ({pickSrcX}, {pickSrcY}) px
                </span>
              </div>
            </details>
            <TilesetPicker
              src={tilesetSrc}
              onPick={handlePickFrame}
              onRemoveAt={handleRemoveFrameAt}
              pickWidthTiles={frameWidthTiles}
              pickHeightTiles={frameHeightTiles}
              pickSrcX={pickSrcX}
              pickSrcY={pickSrcY}
              selectedFrames={frames}
            />
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#666" }}>
              Left click adds a frame. Right click removes the last frame covering that cell.
            </p>
          </div>

          {/* Frame timeline */}
          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#aaa" }}>
              Frames ({frames.length})
            </h3>
            {frames.length === 0 ? (
              <p style={{ color: "#555", fontSize: 13, fontStyle: "italic" }}>
                Click on the tileset above to add frames
              </p>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                {frames.map((f, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setPreviewFrameIdx(i);
                      setPickSrcX(f.srcX);
                      setPickSrcY(f.srcY);
                      setFrameWidthTiles(f.widthTiles ?? 1);
                      setFrameHeightTiles(f.heightTiles ?? 1);
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                      padding: 6,
                      background: "#16162a",
                      borderRadius: 8,
                      border: previewFrameIdx === i ? "1px solid #4fc3f7" : "1px solid #2a2a3e",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 10, color: "#888" }}>#{i + 1}</span>
                    <FramePreview src={tilesetSrc} frame={f} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, width: "100%" }}>
                      <input
                        type="number"
                        value={f.srcX}
                        onChange={(e) => {
                          const srcX = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setFrames((prev) => prev.map((fr, j) => (j === i ? { ...fr, srcX } : fr)));
                          if (previewFrameIdx === i) setPickSrcX(srcX);
                        }}
                        style={{ ...inputStyle, width: "100%", textAlign: "center", fontSize: 10, padding: "2px 4px" }}
                        title="srcX (px)"
                      />
                      <input
                        type="number"
                        value={f.srcY}
                        onChange={(e) => {
                          const srcY = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setFrames((prev) => prev.map((fr, j) => (j === i ? { ...fr, srcY } : fr)));
                          if (previewFrameIdx === i) setPickSrcY(srcY);
                        }}
                        style={{ ...inputStyle, width: "100%", textAlign: "center", fontSize: 10, padding: "2px 4px" }}
                        title="srcY (px)"
                      />
                      <input
                        type="number"
                        value={f.widthTiles ?? 1}
                        onChange={(e) => {
                          const widthTiles = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setFrames((prev) => prev.map((fr, j) => (j === i ? { ...fr, widthTiles } : fr)));
                        }}
                        style={{ ...inputStyle, width: "100%", textAlign: "center", fontSize: 10, padding: "2px 4px" }}
                        title="Frame width (tiles)"
                      />
                      <input
                        type="number"
                        value={f.heightTiles ?? 1}
                        onChange={(e) => {
                          const heightTiles = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setFrames((prev) => prev.map((fr, j) => (j === i ? { ...fr, heightTiles } : fr)));
                        }}
                        style={{ ...inputStyle, width: "100%", textAlign: "center", fontSize: 10, padding: "2px 4px" }}
                        title="Frame height (tiles)"
                      />
                    </div>
                    <input
                      type="number"
                      value={f.durationMs}
                      onChange={(e) => {
                        const ms = Math.max(16, parseInt(e.target.value, 10) || DEFAULT_FRAME_MS);
                        setFrames((prev) => prev.map((fr, j) => (j === i ? { ...fr, durationMs: ms } : fr)));
                      }}
                      style={{ ...inputStyle, width: 50, textAlign: "center", fontSize: 10, padding: "2px 4px" }}
                      title="Duration (ms)"
                    />
                    <span style={{ fontSize: 9, color: "#666" }}>
                      {f.widthTiles ?? 1}×{f.heightTiles ?? 1}
                    </span>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, cursor: "pointer", marginTop: 2 }}>
                      <input
                        type="checkbox"
                        checked={f.horizontalFlip ?? false}
                        onChange={(e) => setFrames((prev) => prev.map((fr, j) => (j === i ? { ...fr, horizontalFlip: e.target.checked } : fr)))}
                        style={{ width: 12, height: 12 }}
                      />
                      <span style={{ color: "#888" }}>Mirror</span>
                    </label>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => handleDuplicateFrame(i)}
                        style={{ background: "none", border: "none", color: "#4fc3f7", cursor: "pointer", fontSize: 13 }}
                        title="Duplicate frame"
                      >
                        ⧉
                      </button>
                      <button
                        onClick={() => handleRemoveFrame(i)}
                        style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14 }}
                        title="Remove frame"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Saved animations */}
          {animations.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, color: "#aaa" }}>
                Saved Animations ({animations.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {animations.map((anim) => (
                  <div
                    key={anim.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      background: selectedId === anim.id ? "#2a2a4e" : "#16162a",
                      borderRadius: 8,
                      border: selectedId === anim.id ? "1px solid #f59e0b" : "1px solid #2a2a3e",
                      cursor: "pointer",
                    }}
                    onClick={() => handleEdit(anim)}
                  >
                    <AnimationPreview anim={anim} size={40} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{anim.name}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>
                        {anim.frames.length} frames · {anim.loop ? "loop" : "once"} ·{" "}
                        {anim.tilesetSrc.split("/").pop()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDuplicate(anim.id); }}
                      style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 14, padding: "0 2px" }}
                      title="Duplicate"
                    >
                      ⧉
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(anim.id); }}
                      style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 16 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Form + Preview */}
        <div style={{ ...cardStyle, position: "sticky", top: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 16px" }}>
            {selectedId ? "Edit Animation" : "New Animation"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>Name</label>
              <input
                style={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. water_flow"
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                Default Frame Duration (ms)
              </label>
              <input
                style={inputStyle}
                type="number"
                min={16}
                step={10}
                value={frameDuration}
                onChange={(e) => setFrameDuration(Math.max(16, parseInt(e.target.value, 10) || DEFAULT_FRAME_MS))}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  New Frame Width
                </label>
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  max={8}
                  value={frameWidthTiles}
                  onChange={(e) => setFrameWidthTiles(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "#888", display: "block", marginBottom: 4 }}>
                  New Frame Height
                </label>
                <input
                  style={inputStyle}
                  type="number"
                  min={1}
                  max={8}
                  value={frameHeightTiles}
                  onChange={(e) => setFrameHeightTiles(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 11, color: "#666", lineHeight: 1.5 }}>
              Clicking the tileset adds a frame using the current width and height. You can still edit each frame size individually below.
            </p>

            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
              />
              Loop
            </label>

            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={handleSave}
                disabled={!name.trim() || frames.length === 0}
                style={{
                  ...btnStyle,
                  flex: 1,
                  background: selectedId ? "#f59e0b" : "#3b82f6",
                  color: "#fff",
                  opacity: name.trim() && frames.length > 0 ? 1 : 0.4,
                }}
              >
                {selectedId ? "Update" : "Save"}
              </button>
              {selectedId && (
                <button onClick={resetForm} style={{ ...btnStyle, background: "#333", color: "#aaa" }}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #333" }}>
            <h3 style={{ fontSize: 13, color: "#888", margin: "0 0 8px" }}>Animation Window Preview</h3>
            <AnimationPreview anim={previewAnim} size={96} />
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "#666" }}>
              {frames.length > 0
                ? `Previewing frame #${Math.min(previewFrameIdx + 1, frames.length)} with current fine-tune values (${frames.length} total)`
                : "Using current fine-tune selection (add frames to build full animation)"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tiny frame preview ─────────────────────────── */
function FramePreview({ src, frame }: { src: string; frame: AnimationFrame }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 40, 40);
    const img = new Image();
    img.onload = () => {
      const sw = (frame.widthTiles ?? 1) * TILESET_TILE_SIZE;
      const sh = (frame.heightTiles ?? 1) * TILESET_TILE_SIZE;
      const aspect = sw / sh;
      let dw = 40;
      let dh = 40;
      if (aspect > 1) {
        dh = 40 / aspect;
      } else {
        dw = 40 * aspect;
      }
      const dx = (40 - dw) / 2;
      const dy = (40 - dh) / 2;
      ctx.save();
      if (frame.horizontalFlip) {
        ctx.translate(40, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, frame.srcX, frame.srcY, sw, sh, dx, dy, dw, dh);
      ctx.restore();
    };
    img.src = src;
  }, [src, frame.srcX, frame.srcY, frame.widthTiles, frame.heightTiles, frame.horizontalFlip]);
  return (
    <canvas
      ref={ref}
      width={40}
      height={40}
      style={{ borderRadius: 4, imageRendering: "pixelated", border: "1px solid #444", background: "#0a0a0a" }}
    />
  );
}
