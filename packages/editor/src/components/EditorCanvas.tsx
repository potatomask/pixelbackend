"use client";

import React, { useRef, useEffect, useLayoutEffect, useCallback, useState, useMemo } from "react";
import { useEditorStore } from "../store";
import { useTilesetImages } from "../hooks/useTilesetImages";
import { isEditableTarget } from "../utils/isEditableTarget";
import {
  getTileDef,
  TILE_EMPTY,
  TILESET_TILE_SIZE,
  getAutoTileSrc,
  isTerrainAutoTile,
  isLinearAutoTile,
  getLinearAutoTileSrc,
  getTerrainAutoTileQuadrants,
  setCustomAutoTileMap,
  setCustomLinearMap,
  setCenterVariants,
  getCenterVariant,
  WATER_TILE_ID,
  WATER_FRAMES,
  WATER_FRAME_MS,
} from "@mypixelpage/shared";
import type { TileLayer, BitmaskMapEntry, CenterVariant, ObjectDef, AnimationDef, AnimationFrame, CustomObjectPayload, ObjectHoverAction } from "@mypixelpage/shared";
import { Home } from "lucide-react";

/* ── Load custom auto-tile maps from localStorage ── */
function loadCustomAutoTileMaps(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("autotile-custom-maps");
    if (!raw) return;
    const maps: Record<string, BitmaskMapEntry[]> = JSON.parse(raw);
    for (const [src, map] of Object.entries(maps)) {
      setCustomAutoTileMap(src, map);
    }
  } catch { /* ignore */ }
}
loadCustomAutoTileMaps();

function loadCustomLinearMaps(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("autotile-linear-maps");
    if (!raw) return;
    const maps: Record<string, BitmaskMapEntry[]> = JSON.parse(raw);
    for (const [src, map] of Object.entries(maps)) {
      setCustomLinearMap(src, map);
    }
  } catch { /* ignore */ }
}
loadCustomLinearMaps();

function loadCenterVariants(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("autotile-center-variants");
    if (!raw) return;
    const all: Record<string, CenterVariant[]> = JSON.parse(raw);
    for (const [src, variants] of Object.entries(all)) {
      setCenterVariants(src, variants);
    }
  } catch { /* ignore */ }
}
loadCenterVariants();

function loadObjectDefsMap(): Record<string, ObjectDef> {
  if (typeof window === "undefined") return {};
  try {
    const defs = JSON.parse(localStorage.getItem("dev-objects") ?? "[]") as ObjectDef[];
    return Object.fromEntries(defs.map((obj) => [obj.id, obj]));
  } catch {
    return {};
  }
}

function loadAnimationDefsMap(): Record<string, AnimationDef> {
  if (typeof window === "undefined") return {};
  try {
    const defs = JSON.parse(localStorage.getItem("dev-animations") ?? "[]") as AnimationDef[];
    return Object.fromEntries(defs.map((anim) => [anim.id, anim]));
  } catch {
    return {};
  }
}

function resolveAnimationFrame(frames: AnimationFrame[], loop: boolean, nowMs: number): AnimationFrame | null {
  if (frames.length === 0) return null;
  const totalDuration = frames.reduce((sum, frame) => sum + Math.max(16, frame.durationMs), 0);
  if (totalDuration <= 0) return frames[0] ?? null;

  if (!loop) {
    let elapsed = 0;
    for (const frame of frames) {
      elapsed += Math.max(16, frame.durationMs);
      if (nowMs < elapsed) return frame;
    }
    return frames[frames.length - 1] ?? null;
  }

  let elapsed = nowMs % totalDuration;
  for (const frame of frames) {
    elapsed -= Math.max(16, frame.durationMs);
    if (elapsed < 0) return frame;
  }
  return frames[frames.length - 1] ?? null;
}

function findTopHoveredObject(
  objects: import("@mypixelpage/shared").WorldObject[],
  objectDefs: Record<string, ObjectDef>,
  cell: { x: number; y: number },
): { obj: import("@mypixelpage/shared").WorldObject; bounds: { x: number; y: number; w: number; h: number } } | null {
  const sorted = [...objects].sort((a, b) => b.gridY - a.gridY);
  for (const obj of sorted) {
    if (obj.type === "custom" && obj.payload.kind === "custom") {
      const def = objectDefs[obj.payload.objectDefId];
      if (!def) continue;
      const left = obj.gridX;
      const top = obj.gridY - (def.heightTiles - 1);
      if (cell.x >= left && cell.x < left + def.widthTiles && cell.y >= top && cell.y <= obj.gridY) {
        return { obj, bounds: { x: left, y: top, w: def.widthTiles, h: def.heightTiles } };
      }
      continue;
    }
    if (obj.gridX === cell.x && obj.gridY === cell.y) {
      return { obj, bounds: { x: obj.gridX, y: obj.gridY, w: 1, h: 1 } };
    }
  }
  return null;
}

/* ── Visual constants ────────────────────────────── */
const GRID_BG = "#1a1a2e";
const GRID_LINE = "rgba(255,255,255,0.05)";
const SPAWN_FILL = "#ffdd00";
const HOVER_FILL = "rgba(255,255,255,0.12)";
const VIGNETTE_COLOR = "rgba(0,0,0,0.25)";
const BASE_TILE_PX = 32; // display pixels per tile at zoom=1
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 6;

interface EditorCanvasProps {
  className?: string;
}

/* ── Component ───────────────────────────────────── */
export function EditorCanvas({ className }: EditorCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPaintingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const spaceHeldRef = useRef(false);

  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1.5 });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const [waterFrame, setWaterFrame] = useState(0);
  const [objectAnimTick, setObjectAnimTick] = useState(0);

  const tilesetImages = useTilesetImages();
  const objectDefs = loadObjectDefsMap();
  const animationDefs = loadAnimationDefsMap();

  const worldData = useEditorStore((s) => s.worldData);
  const tool = useEditorStore((s) => s.tool);
  const paintTile = useEditorStore((s) => s.paintTile);
  const eraseTile = useEditorStore((s) => s.eraseTile);
  const setSpawn = useEditorStore((s) => s.setSpawn);
  const placeObject = useEditorStore((s) => s.placeObject);
  const selectObject = useEditorStore((s) => s.selectObject);
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);

  // Eraser pulse animation
  const [eraserTick, setEraserTick] = useState(0);
  useEffect(() => {
    if (tool !== "eraser" && tool !== "selector") return;
    const id = setInterval(() => setEraserTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, [tool]);

  /* ── Coordinate conversion ── */
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const cam = cameraRef.current;
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const worldX = sx / cam.zoom + cam.x;
      const worldY = sy / cam.zoom + cam.y;
      return { worldX, worldY };
    },
    []
  );

  const screenToGrid = useCallback(
    (clientX: number, clientY: number) => {
      const w = screenToWorld(clientX, clientY);
      if (!w) return null;
      const gx = Math.floor(w.worldX / BASE_TILE_PX);
      const gy = Math.floor(w.worldY / BASE_TILE_PX);
      if (gx < 0 || gy < 0 || gx >= worldData.gridWidth || gy >= worldData.gridHeight) return null;
      return { x: gx, y: gy };
    },
    [worldData.gridWidth, worldData.gridHeight, screenToWorld]
  );

  /* ── Center camera on spawn point initially ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const cam = cameraRef.current;
    const spawnWorldX = worldData.spawnX * BASE_TILE_PX;
    const spawnWorldY = worldData.spawnY * BASE_TILE_PX;
    const cx = spawnWorldX - el.clientWidth / cam.zoom / 2;
    const cy = spawnWorldY - el.clientHeight / cam.zoom / 2;
    setCamera((c) => ({ ...c, x: cx, y: cy }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Animated water background timer ── */
  useEffect(() => {
    const id = setInterval(() => {
      setWaterFrame((f) => (f + 1) % WATER_FRAMES);
    }, WATER_FRAME_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const hasAnimatedObjects = worldData.objects.some((obj) => {
      if (obj.type !== "custom" || obj.payload.kind !== "custom") return false;
      const def = objectDefs[obj.payload.objectDefId];
      return Boolean(def?.animationId && animationDefs[def.animationId]);
    });
    if (!hasAnimatedObjects) return;
    const id = setInterval(() => setObjectAnimTick((tick) => tick + 1), 50);
    return () => clearInterval(id);
  }, [animationDefs, objectDefs, worldData.objects]);

  /* ── Render ──────────────────────────────────────── */
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { x: camX, y: camY, zoom } = camera;
    const tilePx = BASE_TILE_PX * zoom;
    const { gridWidth, gridHeight, layers, spawnX, spawnY, objects } = worldData;

    // Fill entire canvas with grid background
    ctx.fillStyle = GRID_BG;
    ctx.fillRect(0, 0, w, h);

    // Infinite grid lines — span the full viewport regardless of grid bounds
    const firstVisCol = Math.floor(camX / BASE_TILE_PX) - 1;
    const firstVisRow = Math.floor(camY / BASE_TILE_PX) - 1;
    const lastVisCol = Math.ceil((camX + w / zoom) / BASE_TILE_PX) + 1;
    const lastVisRow = Math.ceil((camY + h / zoom) / BASE_TILE_PX) + 1;

    ctx.beginPath();
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    for (let col = firstVisCol; col <= lastVisCol; col++) {
      const x = Math.round((col * BASE_TILE_PX - camX) * zoom) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let row = firstVisRow; row <= lastVisRow; row++) {
      const y = Math.round((row * BASE_TILE_PX - camY) * zoom) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Render tiles — bounded by actual grid
    const startCol = Math.max(0, firstVisCol);
    const startRow = Math.max(0, firstVisRow);
    const endCol = Math.min(gridWidth, lastVisCol);
    const endRow = Math.min(gridHeight, lastVisRow);

    ctx.imageSmoothingEnabled = false;

    // Animated water background — tile the entire visible grid area
    const waterDef = getTileDef(WATER_TILE_ID);
    const waterImg = waterDef?.tilesetSrc ? tilesetImages[waterDef.tilesetSrc] : undefined;
    if (waterImg) {
      const wSrcX = waterFrame * TILESET_TILE_SIZE;
      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          const px = (col * BASE_TILE_PX - camX) * zoom;
          const py = (row * BASE_TILE_PX - camY) * zoom;
          ctx.drawImage(
            waterImg,
            wSrcX, 0, TILESET_TILE_SIZE, TILESET_TILE_SIZE,
            px, py, tilePx, tilePx,
          );
        }
      }
    }

    // Render all tile layers in z-order (supports custom z3+ layers).
    for (let z = 0 as TileLayer; z < layers.length; z++) {
      const layerGrid = layers[z];
      if (!layerGrid) continue;
      for (let row = startRow; row < endRow; row++) {
        for (let col = startCol; col < endCol; col++) {
          const tileId = layerGrid[row]?.[col] ?? TILE_EMPTY;
          if (tileId === TILE_EMPTY) continue;
          const def = getTileDef(tileId);
          if (!def) continue;
          const px = (col * BASE_TILE_PX - camX) * zoom;
          const py = (row * BASE_TILE_PX - camY) * zoom;
          const img = def.tilesetSrc ? tilesetImages[def.tilesetSrc] : undefined;
          if (img) {
            if (def.autoTile && isTerrainAutoTile(tileId)) {
              const quads = getTerrainAutoTileQuadrants(layers, col, row, tileId);
              const half = TILESET_TILE_SIZE / 2;
              const halfPx = tilePx / 2;
              // Detect fully-surrounded center tile (all 4 quadrants point to center fill area)
              const cX = 1 * TILESET_TILE_SIZE;
              const cY = 1 * TILESET_TILE_SIZE;
              const isFullCenter =
                quads.tl.srcX === cX && quads.tl.srcY === cY &&
                quads.tr.srcX === cX + half && quads.tr.srcY === cY &&
                quads.bl.srcX === cX && quads.bl.srcY === cY + half &&
                quads.br.srcX === cX + half && quads.br.srcY === cY + half;
              const variant = isFullCenter && def.tilesetSrc ? getCenterVariant(def.tilesetSrc, col, row) : null;

              if (variant) {
                // Draw full center variant tile
                ctx.drawImage(img, variant.srcX, variant.srcY, TILESET_TILE_SIZE, TILESET_TILE_SIZE, px, py, tilePx, tilePx);
                const overlayImg = def.overlaySrc ? tilesetImages[def.overlaySrc] : undefined;
                if (overlayImg) {
                  ctx.drawImage(overlayImg, variant.srcX, variant.srcY, TILESET_TILE_SIZE, TILESET_TILE_SIZE, px, py, tilePx, tilePx);
                }
              } else {
                // Terrain (grass/stone/soil): 4×8×8 quadrant composition for inner corners
                ctx.drawImage(img, quads.tl.srcX, quads.tl.srcY, half, half, px, py, halfPx, halfPx);
                ctx.drawImage(img, quads.tr.srcX, quads.tr.srcY, half, half, px + halfPx, py, halfPx, halfPx);
                ctx.drawImage(img, quads.bl.srcX, quads.bl.srcY, half, half, px, py + halfPx, halfPx, halfPx);
                ctx.drawImage(img, quads.br.srcX, quads.br.srcY, half, half, px + halfPx, py + halfPx, halfPx, halfPx);
                // Overlay layer (e.g. grass detail) — same quadrant positions
                const overlayImg = def.overlaySrc ? tilesetImages[def.overlaySrc] : undefined;
                if (overlayImg) {
                  ctx.drawImage(overlayImg, quads.tl.srcX, quads.tl.srcY, half, half, px, py, halfPx, halfPx);
                  ctx.drawImage(overlayImg, quads.tr.srcX, quads.tr.srcY, half, half, px + halfPx, py, halfPx, halfPx);
                  ctx.drawImage(overlayImg, quads.bl.srcX, quads.bl.srcY, half, half, px, py + halfPx, halfPx, halfPx);
                  ctx.drawImage(overlayImg, quads.br.srcX, quads.br.srcY, half, half, px + halfPx, py + halfPx, halfPx, halfPx);
                }
              }
            } else if (def.autoTile && isLinearAutoTile(tileId)) {
              // Linear (bridge): dedicated state-based auto-tile
              const src = getLinearAutoTileSrc(layers, col, row, tileId);
              ctx.drawImage(
                img,
                src.srcX, src.srcY, TILESET_TILE_SIZE, TILESET_TILE_SIZE,
                px, py, tilePx, tilePx,
              );
            } else {
              // Path tiles or non-auto: single tile via cardinal bitmask
              const src = def.autoTile
                ? getAutoTileSrc(layers, col, row, tileId)
                : { srcX: def.srcX, srcY: def.srcY };
              ctx.drawImage(
                img,
                src.srcX, src.srcY, TILESET_TILE_SIZE, TILESET_TILE_SIZE,
                px, py, tilePx, tilePx,
              );
            }
          } else {
            ctx.fillStyle = def.color;
            ctx.fillRect(px, py, tilePx, tilePx);
          }
        }
      }
    }

    // Spawn marker
    if (spawnX >= 0 && spawnX < gridWidth && spawnY >= 0 && spawnY < gridHeight) {
      const sx = (spawnX * BASE_TILE_PX - camX) * zoom + tilePx / 2;
      const sy = (spawnY * BASE_TILE_PX - camY) * zoom + tilePx / 2;
      ctx.beginPath();
      ctx.arc(sx, sy, tilePx * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = SPAWN_FILL;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Object markers — Y-sorted for depth (lower Y = behind, higher Y = in front)
    const sortedObjects = [...objects].sort((a, b) => {
      // Use bottom edge Y for sorting: gridY is already the bottom row
      return a.gridY - b.gridY;
    });
    const nowMs = Date.now();
    for (const obj of sortedObjects) {
      if (obj.type === "custom" && obj.payload.kind === "custom") {
        const def = objectDefs[obj.payload.objectDefId];
        if (def) {
          const animation = def.animationId ? animationDefs[def.animationId] : undefined;
          const animatedFrame = animation ? resolveAnimationFrame(animation.frames, animation.loop, nowMs) : null;
          const vIdx = (obj.payload as import("@mypixelpage/shared").CustomObjectPayload).variationIndex ?? 0;
          const variation = vIdx > 0 && def.variations?.[vIdx - 1] ? def.variations[vIdx - 1]! : null;
          const drawSrcX = animatedFrame?.srcX ?? (variation ? variation.srcX : def.srcX);
          const drawSrcY = animatedFrame?.srcY ?? (variation ? variation.srcY : def.srcY);
          const drawTilesetSrc = animation?.tilesetSrc ?? variation?.tilesetSrc ?? def.tilesetSrc;
          const drawWidthTiles = animatedFrame?.widthTiles ?? variation?.widthTiles ?? def.widthTiles;
          const drawHeightTiles = animatedFrame?.heightTiles ?? variation?.heightTiles ?? def.heightTiles;
          const drawHorizontalFlip = animatedFrame?.horizontalFlip ?? variation?.horizontalFlip ?? def.horizontalFlip ?? false;
          const img = tilesetImages[drawTilesetSrc];
          if (img) {
            const topY = obj.gridY - (drawHeightTiles - 1);
            const ox = (obj.gridX * BASE_TILE_PX - camX) * zoom;
            const oy = (topY * BASE_TILE_PX - camY) * zoom;
            ctx.save();
            if (drawHorizontalFlip) {
              ctx.translate(ox + drawWidthTiles * tilePx, oy);
              ctx.scale(-1, 1);
              ctx.drawImage(
                img,
                drawSrcX,
                drawSrcY,
                drawWidthTiles * TILESET_TILE_SIZE,
                drawHeightTiles * TILESET_TILE_SIZE,
                0,
                0,
                drawWidthTiles * tilePx,
                drawHeightTiles * tilePx,
              );
            } else {
              ctx.drawImage(
                img,
                drawSrcX,
                drawSrcY,
                drawWidthTiles * TILESET_TILE_SIZE,
                drawHeightTiles * TILESET_TILE_SIZE,
                ox,
                oy,
                drawWidthTiles * tilePx,
                drawHeightTiles * tilePx,
              );
            }
            ctx.restore();
            continue;
          }
        }
      }
      const ox = (obj.gridX * BASE_TILE_PX - camX) * zoom;
      const oy = (obj.gridY * BASE_TILE_PX - camY) * zoom;
      ctx.fillStyle =
        obj.type === "modal"
          ? "rgba(79,195,247,0.45)"
          : obj.type === "link"
            ? "rgba(129,199,132,0.45)"
            : obj.type === "media"
              ? "rgba(255,183,77,0.45)"
              : "rgba(245,158,11,0.45)";
      ctx.fillRect(ox + 2, oy + 2, tilePx - 4, tilePx - 4);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(10, tilePx * 0.3)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const icon = obj.type === "modal" ? "M" : obj.type === "link" ? "L" : obj.type === "media" ? "I" : "O";
      ctx.fillText(icon, ox + tilePx / 2, oy + tilePx / 2);
    }

    // Hover highlight — yellowish for eraser, purple for selector, white for other tools
    if (hoverCell) {
      if (tool === "eraser" || tool === "selector") {
        const hoverObjBounds = findTopHoveredObject(objects, objectDefs, hoverCell)?.bounds ?? null;

        const isSelector = tool === "selector";
        const pulseR = isSelector ? 192 : 255;
        const pulseG = isSelector ? 132 : 200;
        const pulseB = isSelector ? 252 : 50;

        if (hoverObjBounds) {
          const pulse = 0.3 + 0.2 * Math.sin(Date.now() / 150);
          const ex = (hoverObjBounds.x * BASE_TILE_PX - camX) * zoom;
          const ey = (hoverObjBounds.y * BASE_TILE_PX - camY) * zoom;
          const ew = hoverObjBounds.w * tilePx;
          const eh = hoverObjBounds.h * tilePx;
          ctx.fillStyle = `rgba(${pulseR},${pulseG},${pulseB},${pulse})`;
          ctx.fillRect(ex, ey, ew, eh);
          ctx.strokeStyle = `rgba(${pulseR},${pulseG},${pulseB},0.8)`;
          ctx.lineWidth = 2;
          ctx.strokeRect(ex, ey, ew, eh);
        } else {
          const hx = (hoverCell.x * BASE_TILE_PX - camX) * zoom;
          const hy = (hoverCell.y * BASE_TILE_PX - camY) * zoom;
          ctx.fillStyle = `rgba(${pulseR},${pulseG},${pulseB},0.25)`;
          ctx.fillRect(hx, hy, tilePx, tilePx);
          ctx.strokeStyle = `rgba(${pulseR},${pulseG},${pulseB},0.6)`;
          ctx.lineWidth = 2;
          ctx.strokeRect(hx, hy, tilePx, tilePx);
        }
      } else {
        const hx = (hoverCell.x * BASE_TILE_PX - camX) * zoom;
        const hy = (hoverCell.y * BASE_TILE_PX - camY) * zoom;
        ctx.fillStyle = HOVER_FILL;
        ctx.fillRect(hx, hy, tilePx, tilePx);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 2;
        ctx.strokeRect(hx, hy, tilePx, tilePx);
      }
    }

    // Selected object highlight (selector tool)
    if (selectedObjectId) {
      const selObj = objects.find((o) => o.id === selectedObjectId);
      if (selObj) {
        let selBounds: { x: number; y: number; w: number; h: number };
        if (selObj.type === "custom" && selObj.payload.kind === "custom") {
          const def = objectDefs[(selObj.payload as import("@mypixelpage/shared").CustomObjectPayload).objectDefId];
          if (def) {
            selBounds = { x: selObj.gridX, y: selObj.gridY - (def.heightTiles - 1), w: def.widthTiles, h: def.heightTiles };
          } else {
            selBounds = { x: selObj.gridX, y: selObj.gridY, w: 1, h: 1 };
          }
        } else {
          selBounds = { x: selObj.gridX, y: selObj.gridY, w: 1, h: 1 };
        }
        const sx = (selBounds.x * BASE_TILE_PX - camX) * zoom;
        const sy = (selBounds.y * BASE_TILE_PX - camY) * zoom;
        const sw = selBounds.w * tilePx;
        const sh = selBounds.h * tilePx;
        ctx.strokeStyle = "#c084fc";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(sx, sy, sw, sh);
        ctx.setLineDash([]);
      }
    }

    // Edge vignette — radial gradient fade toward canvas border
    const vigRadius = Math.max(w, h) * 0.6;
    const vig = ctx.createRadialGradient(w / 2, h / 2, vigRadius * 0.15, w / 2, h / 2, vigRadius);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, VIGNETTE_COLOR);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }, [worldData, hoverCell, camera, tilesetImages, waterFrame, tool, objectDefs, animationDefs, eraserTick, objectAnimTick, selectedObjectId]);

  /* ── Resize observer ── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHoverCell((c) => (c ? { ...c } : null)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Keyboard space for pan mode ── */
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      spaceHeldRef.current = true;
    };
    const onUp = (e: KeyboardEvent) => { if (e.code === "Space") { spaceHeldRef.current = false; } };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); };
  }, []);

  /* ── Tool application ────────────────────────────── */
  const applyTool = useCallback(
    (gx: number, gy: number) => {
      switch (tool) {
        case "brush": paintTile(gx, gy); break;
        case "eraser": eraseTile(gx, gy); break;
        case "spawn": setSpawn(gx, gy); break;
        case "object": placeObject(gx, gy); break;
        case "selector": {
          const hovered = findTopHoveredObject(useEditorStore.getState().worldData.objects, objectDefs, { x: gx, y: gy });
          selectObject(hovered?.obj.id ?? null);
          break;
        }
      }
    },
    [tool, paintTile, eraseTile, setSpawn, placeObject, selectObject, objectDefs]
  );

  /* ── Mouse events ────────────────────────────────── */
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Middle-click or space+left-click → pan
      if (e.button === 1 || (e.button === 0 && spaceHeldRef.current)) {
        e.preventDefault();
        isPanningRef.current = true;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        return;
      }
      if (e.button !== 0) return;
      const cell = screenToGrid(e.clientX, e.clientY);
      if (!cell) return;
      isPaintingRef.current = true;
      applyTool(cell.x, cell.y);
    },
    [screenToGrid, applyTool]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - lastPanRef.current.x;
        const dy = e.clientY - lastPanRef.current.y;
        lastPanRef.current = { x: e.clientX, y: e.clientY };
        setCamera((c) => ({ ...c, x: c.x - dx / c.zoom, y: c.y - dy / c.zoom }));
        return;
      }
      const cell = screenToGrid(e.clientX, e.clientY);
      setHoverCell(cell);
      if (isPaintingRef.current && cell && (tool === "brush" || tool === "eraser")) {
        applyTool(cell.x, cell.y);
      }
    },
    [screenToGrid, tool, applyTool]
  );

  const handleMouseUp = useCallback(() => {
    isPaintingRef.current = false;
    isPanningRef.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isPaintingRef.current = false;
    isPanningRef.current = false;
    setHoverCell(null);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      setCamera((c) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, c.zoom * factor));
        // Zoom towards mouse position
        const worldX = mx / c.zoom + c.x;
        const worldY = my / c.zoom + c.y;
        return {
          x: worldX - mx / newZoom,
          y: worldY - my / newZoom,
          zoom: newZoom,
        };
      });
    },
    []
  );

  const cursor = spaceHeldRef.current || isPanningRef.current ? "grab" : "crosshair";

  const goHome = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const spawnWorldX = worldData.spawnX * BASE_TILE_PX;
    const spawnWorldY = worldData.spawnY * BASE_TILE_PX;
    setCamera((c) => ({
      ...c,
      x: spawnWorldX - el.clientWidth / c.zoom / 2,
      y: spawnWorldY - el.clientHeight / c.zoom / 2,
    }));
  }, [worldData.spawnX, worldData.spawnY]);

  const canvasHoverPreview = useMemo(() => {
    if (!selectedObjectId) return null;
    const obj = worldData.objects.find((o) => o.id === selectedObjectId);
    if (!obj || obj.payload.kind !== "custom") return null;

    const payload = obj.payload as CustomObjectPayload;
    if (!payload.hoverPreview || !payload.onHover || payload.onHover.type === "none") return null;

    const def = objectDefs[payload.objectDefId];
    if (!def) return null;

    const anchor = payload.hoverAnchor ?? { x: 0.5, y: 0 };
    const topY = obj.gridY - (def.heightTiles - 1);
    const worldX = (obj.gridX + anchor.x * def.widthTiles) * BASE_TILE_PX;
    const worldY = (topY + anchor.y * def.heightTiles) * BASE_TILE_PX;
    const left = (worldX - camera.x) * camera.zoom;
    const top = (worldY - camera.y) * camera.zoom;
    // Multiply user's media scale by camera zoom so the overlay feels "part of"
    // the world — it shrinks/grows proportionally with the map when zooming.
    const scale = Math.min(4, Math.max(0.25, payload.hoverMediaScale ?? 1)) * camera.zoom;

    return {
      left,
      top,
      scale,
      onHover: payload.onHover as ObjectHoverAction,
    };
  }, [selectedObjectId, worldData.objects, objectDefs, camera]);

  const canvasBillboards = useMemo(() => {
    return worldData.objects
      .filter((o) => o.payload.kind === "custom")
      .map((o) => {
        const payload = o.payload as CustomObjectPayload;
        const action = payload.billboard;
        if (!action || action.type === "none") return null;
        if (payload.billboardPreview === false) return null;
        if (payload.billboardClosable && payload.billboardOpen === false) return null;
        const def = objectDefs[payload.objectDefId];
        if (!def) return null;

        const anchor = payload.billboardAnchor ?? { x: 0.5, y: 0 };
        const topY = o.gridY - (def.heightTiles - 1);
        const worldX = (o.gridX + anchor.x * def.widthTiles) * BASE_TILE_PX;
        const worldY = (topY + anchor.y * def.heightTiles) * BASE_TILE_PX;
        const left = (worldX - camera.x) * camera.zoom;
        const top = (worldY - camera.y) * camera.zoom;
        const scale = Math.min(4, Math.max(0.25, payload.billboardMediaScale ?? 1)) * camera.zoom;

        return { id: o.id, left, top, scale, action: action as ObjectHoverAction };
      })
      .filter((item): item is { id: string; left: number; top: number; scale: number; action: ObjectHoverAction } => Boolean(item));
  }, [worldData.objects, objectDefs, camera]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className ?? ""}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: "none", cursor }}
      />

      {canvasHoverPreview && (
        <div
          style={{
            position: "absolute",
            left: canvasHoverPreview.left,
            top: canvasHoverPreview.top - 10,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 20,
          }}
        >
          {canvasHoverPreview.onHover.type === "showText" && (
            <div
              style={{
                padding: "6px 12px",
                backgroundColor: "rgba(17,24,39,0.92)",
                borderRadius: 8,
                fontSize: Math.max(11, 13 * canvasHoverPreview.scale),
                color: "#e5e7eb",
                maxWidth: 240,
                textAlign: "center",
                border: "1px solid rgba(75,85,99,0.5)",
                whiteSpace: "pre-wrap",
              }}
            >
              {canvasHoverPreview.onHover.text || "Hover text preview"}
            </div>
          )}

          {canvasHoverPreview.onHover.type === "showImage" && canvasHoverPreview.onHover.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={canvasHoverPreview.onHover.imageUrl}
              alt=""
              style={{
                maxWidth: 150 * canvasHoverPreview.scale,
                maxHeight: 100 * canvasHoverPreview.scale,
                borderRadius: 6,
                border: "2px solid rgba(75,85,99,0.5)",
                objectFit: "contain",
                backgroundColor: "rgba(0,0,0,0.22)",
              }}
            />
          )}

          {canvasHoverPreview.onHover.type === "showVideo" && canvasHoverPreview.onHover.videoUrl && (
            <video
              src={canvasHoverPreview.onHover.videoUrl}
              autoPlay
              muted
              loop
              playsInline
              style={{
                maxWidth: 220 * canvasHoverPreview.scale,
                maxHeight: 140 * canvasHoverPreview.scale,
                borderRadius: 6,
                border: "2px solid rgba(75,85,99,0.5)",
                objectFit: "contain",
                backgroundColor: "rgba(0,0,0,0.7)",
              }}
            />
          )}
        </div>
      )}

      {canvasBillboards.map((bb) => (
        <div
          key={`billboard-${bb.id}`}
          style={{
            position: "absolute",
            left: bb.left,
            top: bb.top - 10,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 19,
          }}
        >
          {bb.action.type === "showText" && (
            <div
              style={{
                padding: "6px 12px",
                backgroundColor: "rgba(17,24,39,0.92)",
                borderRadius: 8,
                fontSize: Math.max(11, 13 * bb.scale),
                color: "#e5e7eb",
                maxWidth: 240,
                textAlign: "center",
                border: "1px solid rgba(75,85,99,0.5)",
                whiteSpace: "pre-wrap",
              }}
            >
              {bb.action.text || "Billboard text"}
            </div>
          )}
          {bb.action.type === "showImage" && bb.action.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bb.action.imageUrl}
              alt=""
              style={{
                maxWidth: 150 * bb.scale,
                maxHeight: 100 * bb.scale,
                borderRadius: 6,
                border: "2px solid rgba(75,85,99,0.5)",
                objectFit: "contain",
                backgroundColor: "rgba(0,0,0,0.22)",
              }}
            />
          )}
          {bb.action.type === "showVideo" && bb.action.videoUrl && (
            <video
              src={bb.action.videoUrl}
              autoPlay
              muted
              loop
              playsInline
              style={{
                maxWidth: 220 * bb.scale,
                maxHeight: 140 * bb.scale,
                borderRadius: 6,
                border: "2px solid rgba(75,85,99,0.5)",
                objectFit: "contain",
                backgroundColor: "rgba(0,0,0,0.7)",
              }}
            />
          )}
        </div>
      ))}

      {/* Home button */}
      <button
        onClick={goHome}
        title="Go to spawn (Home)"
        style={{
          position: "absolute", bottom: 12, right: 12,
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 14px",
          backgroundColor: "#3a3a3a", color: "#e0e0e0",
          border: "1px solid #555", borderRadius: 6,
          fontSize: 13, fontWeight: 600, cursor: "pointer",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
          transition: "background-color 0.2s",
          userSelect: "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4a4a4a")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#3a3a3a")}
      >
        <Home size={15} />
        Home
      </button>

      {/* Zoom indicator + Controls help */}
      <div style={{
        position: "absolute", bottom: 12, left: 12,
        fontSize: 11, color: "#fff", userSelect: "none", pointerEvents: "none",
        lineHeight: 1.7, fontFamily: "monospace",
        textShadow: "0 1px 3px rgba(0,0,0,0.7), 0 0 8px rgba(0,0,0,0.5)",
      }}>
        <div>{Math.round(camera.zoom * 100)}%</div>
        <div style={{ marginTop: 6, fontSize: 10, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.7), 0 0 8px rgba(0,0,0,0.5)" }}>
          Space + Drag — Pan<br />
          Scroll — Zoom<br />
          B — Brush &nbsp; E — Erase<br />
          S — Spawn &nbsp; O — Object<br />
          Ctrl+Z / Y — Undo / Redo
        </div>
      </div>
    </div>
  );
}
