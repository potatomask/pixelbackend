"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { EditorCanvas } from "./EditorCanvas";
import { Toolbar } from "./Toolbar";
import { TilePalette } from "./TilePalette";
import { ObjectPropsPanel } from "./ObjectPropsPanel";
import { PageViewerModal } from "./PageEditor";
import { SidePagePanel } from "./SidePagePanel";
import { useEditorStore } from "../store";
import { isEditableTarget } from "../utils/isEditableTarget";
import { Engine } from "@mypixelpage/runtime";
import { DEFAULT_TILE_SIZE } from "@mypixelpage/shared";
import type { WorldData, WorldObject, CustomObjectPayload, PageContent } from "@mypixelpage/shared";
import { T } from "./theme";

/** Live PixiJS preview that runs the actual game engine. */
function LivePreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const worldData = useEditorStore((s) => s.worldData);
  const worldDataRef = useRef<WorldData>(worldData);
  worldDataRef.current = worldData;

  // Interaction state
  const [activePageContent, setActivePageContent] = useState<PageContent | null>(null);
  const [nearbyLabel, setNearbyLabel] = useState<string | null>(null);
  const [mouseHoveredId, setMouseHoveredId] = useState<string | null>(null);
  const mouseHoveredIdRef = useRef<string | null>(null);
  const overlayDivRef = useRef<HTMLDivElement>(null);
  const overlayImgRef = useRef<HTMLImageElement>(null);
  const overlayVideoRef = useRef<HTMLVideoElement>(null);
  const overlayTextRef = useRef<HTMLDivElement>(null);
  const billboardOuterRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const billboardImgRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const billboardVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const billboardTextRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const billboardOpenOverridesRef = useRef<Record<string, boolean>>({});
  const [billboardTick, setBillboardTick] = useState(0);

  const handleInteraction = useCallback((objectId: string) => {
    const obj = worldDataRef.current.objects.find((o) => o.id === objectId);
    if (!obj || obj.payload.kind !== "custom") return;
    const payload = obj.payload as CustomObjectPayload;
    if (payload.billboard && payload.billboard.type !== "none") {
      if (payload.billboardClosable) {
        const current = billboardOpenOverridesRef.current[objectId] ?? (payload.billboardOpen ?? true);
        billboardOpenOverridesRef.current[objectId] = !current;
        setBillboardTick((n) => n + 1);
      }
      return;
    }
    const def = worldDataRef.current.assets?.objects?.find((item) => item.id === payload.objectDefId);
    const isInteractable = def?.interactable ?? payload.interactable ?? false;
    if (!isInteractable || !payload.onClick) return;
    if (payload.onClick.type === "openPageEditor" && payload.onClick.pageContent) {
      setActivePageContent(payload.onClick.pageContent);
    }
  }, []);

  const handleProximity = useCallback((objectId: string | null) => {
    if (!objectId) {
      setNearbyLabel(null);
      return;
    }
    const obj = worldDataRef.current.objects.find((o) => o.id === objectId);
    if (!obj) { setNearbyLabel(null); return; }
    setNearbyLabel(obj.label);
  }, []);

  const handleMouseHover = useCallback((objectId: string | null) => {
    mouseHoveredIdRef.current = objectId;
    setMouseHoveredId(objectId);
  }, []);

  // Fired inside the engine's tick after camera transforms are applied — same frame,
  // no separate RAF racing. Also sets pixel sizes directly (no CSS scale) so they
  // match the editor canvas formula: maxWidth = 150 * mediaScale * camera.zoom.
  const handleAfterFrame = useCallback(() => {
    const id = mouseHoveredIdRef.current;
    const outer = overlayDivRef.current;
    const zoom = engineRef.current?.getCameraZoom() ?? 2.2;
    const effectiveScale = zoom;
    if (outer) {
      if (!id) {
        outer.style.visibility = 'hidden';
      } else {
        const pos = engineRef.current?.getObjectScreenPosition(id);
        if (!pos) {
          outer.style.visibility = 'hidden';
        } else {
          const obj = worldDataRef.current.objects.find((o) => o.id === id);
          const p = obj?.payload.kind === 'custom' ? obj.payload as CustomObjectPayload : null;
          const mediaScale = Math.min(4, Math.max(0.25, p?.hoverMediaScale ?? 1));
          outer.style.transform = `translate3d(calc(${pos.x}px - 50%), calc(${pos.y - 10}px - 100%), 0)`;
          outer.style.visibility = 'visible';
          const img = overlayImgRef.current;
          if (img) {
            img.style.maxWidth  = `${Math.round(150 * mediaScale * effectiveScale)}px`;
            img.style.maxHeight = `${Math.round(100 * mediaScale * effectiveScale)}px`;
          }
          const video = overlayVideoRef.current;
          if (video) {
            video.style.maxWidth  = `${Math.round(220 * mediaScale * effectiveScale)}px`;
            video.style.maxHeight = `${Math.round(140 * mediaScale * effectiveScale)}px`;
          }
          const text = overlayTextRef.current;
          if (text) text.style.fontSize = `${Math.max(11, Math.round(13 * effectiveScale))}px`;
        }
      }
    }

    for (const worldObj of worldDataRef.current.objects) {
      if (worldObj.payload.kind !== "custom") continue;
      const bp = worldObj.payload as CustomObjectPayload;
      const action = bp.billboard;
      const outer = billboardOuterRefs.current[worldObj.id];
      if (!outer || !action || action.type === "none") {
        if (outer) outer.style.visibility = "hidden";
        continue;
      }

      const open = billboardOpenOverridesRef.current[worldObj.id] ?? (bp.billboardOpen ?? true);
      if (!open) {
        outer.style.visibility = "hidden";
        continue;
      }

      const anchor = bp.billboardAnchor ?? { x: 0.5, y: 0 };
      const bPos = engineRef.current?.getObjectScreenPosition(worldObj.id, anchor);
      if (!bPos) {
        outer.style.visibility = "hidden";
        continue;
      }

      const bScale = Math.min(4, Math.max(0.25, bp.billboardMediaScale ?? 1));
      outer.style.transform = `translate3d(calc(${bPos.x}px - 50%), calc(${bPos.y - 10}px - 100%), 0)`;
      outer.style.visibility = "visible";

      const bImg = billboardImgRefs.current[worldObj.id];
      if (bImg) {
        bImg.style.maxWidth = `${Math.round(150 * bScale * effectiveScale)}px`;
        bImg.style.maxHeight = `${Math.round(100 * bScale * effectiveScale)}px`;
      }
      const bVideo = billboardVideoRefs.current[worldObj.id];
      if (bVideo) {
        bVideo.style.maxWidth = `${Math.round(220 * bScale * effectiveScale)}px`;
        bVideo.style.maxHeight = `${Math.round(140 * bScale * effectiveScale)}px`;
      }
      const bText = billboardTextRefs.current[worldObj.id];
      if (bText) bText.style.fontSize = `${Math.max(11, Math.round(13 * effectiveScale))}px`;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setPreviewError(null);

    const timer = setTimeout(() => {
      const engine = new Engine({
        canvas,
        worldData,
        tileSize: DEFAULT_TILE_SIZE,
        onInteraction: handleInteraction,
        onInteractionProximity: handleProximity,
        onMouseHover: handleMouseHover,
        onAfterFrame: handleAfterFrame,
        onError: (err) => {
          console.error("Engine runtime error:", err);
          if (!cancelled) setPreviewError(err instanceof Error ? err.message : "Render error — try refreshing");
        },
      });
      engineRef.current = engine;
      engine.init().catch((err) => {
        console.error("Engine init failed:", err);
        if (!cancelled) setPreviewError(err instanceof Error ? err.message : "Failed to start preview");
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
}, [worldData, handleAfterFrame, handleInteraction, handleProximity, handleMouseHover]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", backgroundColor: T.canvasBg }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      {previewError && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            right: 12,
            backgroundColor: "rgba(127, 29, 29, 0.9)",
            color: "#fecaca",
            border: "1px solid rgba(248, 113, 113, 0.6)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 13,
            fontFamily: "monospace",
            zIndex: 2,
          }}
        >
          Preview failed: {previewError}
        </div>
      )}

      {/* Interaction prompt */}
      {nearbyLabel && !activePageContent && (
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 3,
          padding: "6px 14px", backgroundColor: "rgba(17,24,39,0.9)", borderRadius: 20,
          fontSize: 13, border: "1px solid rgba(75,85,99,0.6)", color: T.textLight, whiteSpace: "nowrap",
        }}>
          <span style={{ color: T.textMuted }}>Press </span>
          <kbd style={{ padding: "1px 5px", backgroundColor: "rgba(55,65,81,1)", borderRadius: 3, fontSize: 11, fontFamily: "monospace" }}>E</kbd>
          <span style={{ color: T.textMuted }}> to interact with </span>
          <span style={{ fontWeight: 600 }}>{nearbyLabel}</span>
        </div>
      )}

      {/* Hover overlay — always mounted; engine onAfterFrame sets position and sizes */}
      {(() => {
        const obj = mouseHoveredId
          ? worldDataRef.current.objects.find((o) => o.id === mouseHoveredId)
          : null;
        const p = (obj?.payload.kind === 'custom') ? obj.payload as CustomObjectPayload : null;
        const onHover = (p?.onHover && p.onHover.type !== 'none') ? p.onHover : null;
        return (
          <div
            ref={overlayDivRef}
            style={{
              position: 'absolute', left: 0, top: 0, visibility: 'hidden',
              zIndex: 4, pointerEvents: 'none', willChange: 'transform',
            }}
          >
            {onHover?.type === 'showText' && (
              <div ref={overlayTextRef} style={{
                padding: '6px 12px', backgroundColor: 'rgba(17,24,39,0.92)', borderRadius: 8,
                fontSize: 13, color: T.textLight, maxWidth: 240, textAlign: 'center' as const,
                border: '1px solid rgba(75,85,99,0.5)', whiteSpace: 'pre-wrap' as const,
              }}>
                {onHover.text}
              </div>
            )}
            {onHover?.type === 'showImage' && onHover.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img ref={overlayImgRef} src={onHover.imageUrl} alt="" style={{
                display: 'block', borderRadius: 6,
                border: '2px solid rgba(75,85,99,0.5)', objectFit: 'contain' as const,
              }} />
            )}
            {onHover?.type === 'showVideo' && onHover.videoUrl && (
              <video
                ref={overlayVideoRef}
                src={onHover.videoUrl}
                autoPlay
                muted
                loop
                playsInline
                style={{
                  display: 'block', borderRadius: 6,
                  border: '2px solid rgba(75,85,99,0.5)', objectFit: 'contain' as const,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                }}
              />
            )}
          </div>
        );
      })()}

      {/* Billboard overlays — always on */}
      {(() => {
        const _tick = billboardTick;
        void _tick;
        return worldData.objects
          .filter((o) => o.payload.kind === "custom")
          .map((o) => {
            const p = o.payload as CustomObjectPayload;
            const action = p.billboard;
            if (!action || action.type === "none") return null;
            const open = billboardOpenOverridesRef.current[o.id] ?? (p.billboardOpen ?? true);
            const fallbackScale = Math.min(4, Math.max(0.25, p.billboardMediaScale ?? 1));
            return (
              <div
                key={`billboard-${o.id}`}
                ref={(el) => { billboardOuterRefs.current[o.id] = el; }}
                onClick={() => {
                  if (!p.billboardClosable) return;
                  const current = billboardOpenOverridesRef.current[o.id] ?? (p.billboardOpen ?? true);
                  billboardOpenOverridesRef.current[o.id] = !current;
                  setBillboardTick((n) => n + 1);
                }}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  visibility: open ? "visible" : "hidden",
                  zIndex: 4,
                  pointerEvents: p.billboardClosable ? "auto" : "none",
                  cursor: p.billboardClosable ? "pointer" : "default",
                  willChange: "transform",
                }}
              >
                {action.type === "showText" && (
                  <div
                    ref={(el) => { billboardTextRefs.current[o.id] = el; }}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "rgba(17,24,39,0.92)",
                      borderRadius: 8,
                      fontSize: 13,
                      color: T.textLight,
                      maxWidth: 240,
                      textAlign: "center",
                      border: "1px solid rgba(75,85,99,0.5)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {action.text}
                  </div>
                )}
                {action.type === "showImage" && action.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    ref={(el) => { billboardImgRefs.current[o.id] = el; }}
                    src={action.imageUrl}
                    alt=""
                    style={{
                      display: "block",
                      maxWidth: 150 * fallbackScale,
                      maxHeight: 100 * fallbackScale,
                      borderRadius: 6,
                      border: "2px solid rgba(75,85,99,0.5)",
                      objectFit: "contain",
                      backgroundColor: "rgba(0,0,0,0.22)",
                    }}
                  />
                )}
                {action.type === "showVideo" && action.videoUrl && (
                  <video
                    ref={(el) => { billboardVideoRefs.current[o.id] = el; }}
                    src={action.videoUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={{
                      display: "block",
                      maxWidth: 220 * fallbackScale,
                      maxHeight: 140 * fallbackScale,
                      borderRadius: 6,
                      border: "2px solid rgba(75,85,99,0.5)",
                      objectFit: "contain",
                      backgroundColor: "rgba(0,0,0,0.7)",
                    }}
                  />
                )}
              </div>
            );
          });
      })()}

      <div style={{
        position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
        padding: "6px 18px", backgroundColor: T.sidebarBg, color: T.textLight,
        border: `1px solid ${T.border}`, borderRadius: 6, fontSize: 13, fontFamily: "monospace",
        letterSpacing: 1, textTransform: "uppercase", userSelect: "none",
      }}>
        WASD to move · Wheel to zoom · E to interact
      </div>

      {/* Page viewer modal */}
      {activePageContent && (
        <PageViewerModal pageContent={activePageContent} onClose={() => setActivePageContent(null)} />
      )}
    </div>
  );
}

export function EditorShell({ openFeedback }: { openFeedback?: () => void }) {
  const [isPreview, setIsPreview] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(310);
  const worldData = useEditorStore((s) => s.worldData);
  const [sidePagePanelOpen, setSidePagePanelOpen] = useState(
    worldData.sidePageConfig?.showByDefault ?? false
  );
  const loadWorldData = useEditorStore((s) => s.loadWorldData);
  const loadFromServer = useEditorStore((s) => s.loadFromServer);
  const setUserTier = useEditorStore((s) => s.setUserTier);
  const resetForUser = useEditorStore((s) => s.resetForUser);
  const isLoading = useEditorStore((s) => s.isLoading);

  // Fetch user identity, reset store for the active user, then load their world.
  // resetForUser handles clearing stale localStorage and Zustand state so the
  // incoming user starts from a clean slate before any server data arrives.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Fetch auth + settings
      try {
        const [meData, creditData, categoriesData, windData] = await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ user: null })),
          fetch("/api/settings/dev-credit-config", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ value: null })),
          fetch("/api/settings/dev-categories", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ value: null })),
          fetch("/api/settings/dev-wind-config", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ value: null })),
        ]) as [
          { user?: { id?: string; tier?: string } | null },
          { value?: string | null },
          { value?: string | null },
          { value?: string | null },
        ];
        if (cancelled) return;

        // 2. Reset store if a different user (clears localStorage + Zustand state)
        const currentUserId = meData?.user?.id;
        if (currentUserId) {
          resetForUser(currentUserId);
        }

        // 3. Apply settings
        const tier = meData?.user?.tier;
        if (tier === "FREE" || tier === "STARTER" || tier === "PRO" || tier === "TESTER") {
          setUserTier(tier as import("@mypixelpage/shared").UserTier);
        }
        if (creditData?.value) {
          localStorage.setItem("dev-credit-config", creditData.value);
        }
        if (categoriesData?.value) {
          localStorage.setItem("dev-categories", categoriesData.value);
        }
        if (windData?.value) {
          localStorage.setItem("dev-wind-config", windData.value);
        }

        // 3b. Load all dev-settings from DB into localStorage (fire-and-forget)
        const devKeys = [
          "dev-tiles", "dev-objects", "dev-animations", "dev-character-config",
          "dev-sidepage-themes", "dev-tag-rules", "dev-custom-tileset-sources",
          "autotile-custom-maps", "autotile-quadrant-maps",
          "autotile-center-variants", "autotile-linear-maps",
          "dev-wind-config",
        ];
        try {
          await Promise.all(
            devKeys.map(async (key) => {
              try {
                const res = await fetch(`/api/settings/${encodeURIComponent(key)}`, { cache: "no-store" });
                if (!res.ok) return;
                const data = (await res.json()) as { value?: string | null };
                if (data?.value != null) {
                  localStorage.setItem(key, data.value);
                }
              } catch { /* silent */ }
            }),
          );
        } catch { /* silent */ }

        // Retry any dev-settings that failed to write to server on a previous session
        try {
          const dirtyRaw = localStorage.getItem("__dev-settings-dirty");
          if (dirtyRaw) {
            const dirtyKeys = JSON.parse(dirtyRaw) as string[];
            const remaining: string[] = [];
            for (const dk of dirtyKeys) {
              const val = localStorage.getItem(dk);
              if (!val) continue;
              try {
                const r = await fetch("/api/admin/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ key: dk, value: val }),
                });
                if (!r.ok) remaining.push(dk);
              } catch {
                remaining.push(dk);
              }
            }
            if (remaining.length === 0) localStorage.removeItem("__dev-settings-dirty");
            else localStorage.setItem("__dev-settings-dirty", JSON.stringify(remaining));
          }
        } catch { /* silent */ }
      } catch {
        /* silent — editor still works with localStorage fallback */
      }

      if (cancelled) return;


          // One-time backfill: set freeTierOk=true for all existing assets/themes.
          const backfillKey = "dev-free-tier-ok-migration-editor-v1";
          if (!localStorage.getItem(backfillKey)) {
            const writeSetting = async (key: string, value: string) => {
              localStorage.setItem(key, value);
              try {
                await fetch("/api/admin/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ key, value }),
                });
              } catch {
                // localStorage is still updated even if sync fails
              }
            };

            try {
              const rawTiles = localStorage.getItem("dev-tiles");
              if (rawTiles) {
                const tiles = JSON.parse(rawTiles) as Array<Record<string, unknown>>;
                const normalized = tiles.map((t) => ({ ...t, freeTierOk: true }));
                await writeSetting("dev-tiles", JSON.stringify(normalized));
              }
            } catch { /* ignore */ }

            try {
              const rawObjects = localStorage.getItem("dev-objects");
              if (rawObjects) {
                const objects = JSON.parse(rawObjects) as Array<Record<string, unknown>>;
                const normalized = objects.map((o) => ({ ...o, freeTierOk: true }));
                await writeSetting("dev-objects", JSON.stringify(normalized));
              }
            } catch { /* ignore */ }

            try {
              const rawThemes = localStorage.getItem("dev-sidepage-themes");
              if (rawThemes) {
                const themes = JSON.parse(rawThemes) as Array<Record<string, unknown>>;
                const normalized = themes.map((t) => ({ ...t, freeTierOk: true }));
                await writeSetting("dev-sidepage-themes", JSON.stringify(normalized));
              }
            } catch { /* ignore */ }

            localStorage.setItem(backfillKey, "1");
          }
      // 4. Load world: try server first, fall back to localStorage
      const loaded = await loadFromServer();
      if (cancelled) return;
      if (!loaded) {
        try {
          const stale = localStorage.getItem("world-dev");
          if (stale && !localStorage.getItem("dev-world")) {
            localStorage.setItem("dev-world", stale);
          }
          const saved = localStorage.getItem("dev-world");
          if (saved) {
            const data = JSON.parse(saved) as WorldData;
            if (data && data.layers && data.gridWidth) {
              loadWorldData(data, "dev");
            }
          }
        } catch {
          // ignore parse errors
        }
        // Ensure isLoading is cleared even when server load failed
        useEditorStore.setState({ isLoading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [setUserTier, loadWorldData, loadFromServer, resetForUser]);
  const isResizingRef = useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newW = Math.max(160, Math.min(500, startW + (ev.clientX - startX)));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      isResizingRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key.toUpperCase() === "P" && !e.ctrlKey && !e.metaKey) {
        setIsPreview((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{
      display: "flex", flexDirection: "column", width: "100vw", height: "100vh",
      backgroundColor: T.bodyBg, color: T.textLight, fontFamily: "Arial, sans-serif",
      overflow: "hidden", margin: 0, padding: 0,
    }}>
      {/* Don't mount editor children until the correct user's world is loaded.
          This prevents TilePalette, EditorCanvas, etc. from reading stale
          localStorage data left by a previous account. */}
      {isLoading ? (
        <div style={{
          flexGrow: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ color: T.textLight, fontSize: 16, opacity: 0.7 }}>Loading world…</span>
        </div>
      ) : (
        <>
          {/* ─── HEADER ─── */}
          <Toolbar isPreview={isPreview} setIsPreview={setIsPreview} openFeedback={openFeedback} />

          {/* ─── MAIN CONTENT ─── */}
          <div style={{ display: "flex", flexGrow: 1, overflow: "hidden" }}>
            {/* Left Sidebar + Resize Handle */}
            {!isPreview && (
              <div style={{ display: "flex", flexShrink: 0 }} data-tour-left-palette>
                <div style={{ width: sidebarWidth, overflow: "hidden" }}>
                  <TilePalette />
                </div>
                <div
                  onMouseDown={handleResizeStart}
                  style={{
                    width: 5, cursor: "col-resize",
                    backgroundColor: "transparent",
                    transition: "background-color 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = T.blue)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                />
              </div>
            )}

            {/* Canvas Area */}
            <main style={{ flexGrow: 1, position: "relative", overflow: "hidden", backgroundColor: T.canvasBg }} data-tour-canvas>
              {/* Floating stop button — only shown in preview */}
              {isPreview && (
                <button
                  onClick={() => setIsPreview(false)}
                  title="Stop Preview"
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    zIndex: 999,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 6,
                    background: "rgba(239,68,68,0.35)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    border: "1px solid rgba(239,68,68,0.6)",
                    color: "white",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "system-ui, sans-serif",
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    boxShadow: "0 2px 16px rgba(239,68,68,0.25)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.6)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.35)"; }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
                    <rect x="0" y="0" width="10" height="10" rx="1.5" />
                  </svg>
                  STOP
                </button>
              )}

              {isPreview ? <LivePreview /> : <EditorCanvas className="w-full h-full block" />}

              <SidePagePanel
                config={worldData.sidePageConfig}
                isOpen={sidePagePanelOpen}
                onToggle={() => setSidePagePanelOpen((prev) => !prev)}
                onConfigChange={(newConfig) => {
                  useEditorStore.setState((state) => ({
                    worldData: {
                      ...state.worldData,
                      sidePageConfig: newConfig,
                    },
                    isDirty: true,
                  }));
                }}
                position="absolute"
                readOnly={isPreview}
              />
            </main>

            {/* Right Inspector */}
            {!isPreview && <ObjectPropsPanel data-tour-right-props />}
          </div>
        </>
      )}
    </div>
  );
}
