"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Engine } from "@mypixelpage/runtime";
import { PageViewerModal, SidePagePanel } from "@mypixelpage/editor";
import type { WorldData, WorldObject, PublicWorldResponse, CustomObjectPayload, PageContent, SidePageConfig } from "@mypixelpage/shared";
import { isUrlSafe } from "@mypixelpage/shared";

interface VisitorClientProps {
  slug: string;
}

export function VisitorClient({ slug }: VisitorClientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [worldResponse, setWorldResponse] = useState<PublicWorldResponse | null>(null);
  const [activeObj, setActiveObj] = useState<WorldObject | null>(null);
  const [activePageContent, setActivePageContent] = useState<PageContent | null>(null);
  const [nearbyLabel, setNearbyLabel] = useState<string | null>(null);
  const [mouseHoveredObj, setMouseHoveredObj] = useState<WorldObject | null>(null);
  const [sidePagePanelOpen, setSidePagePanelOpen] = useState(false);
  const mouseHoveredObjRef = useRef<WorldObject | null>(null);
  const worldDataRef = useRef<WorldData | null>(null);
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
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Detect device type
  const getDeviceType = () => {
    if (typeof window === "undefined") return "desktop";
    const w = window.innerWidth;
    if (w < 768) return "mobile" as const;
    if (w < 1024) return "tablet" as const;
    return "desktop" as const;
  };

  // Track page view
  const trackView = useCallback(
    (worldId: string) => {
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldId,
          eventType: "page_view",
          deviceType: getDeviceType(),
        }),
      }).catch(() => {});
    },
    []
  );

  // Track interaction
  const trackInteraction = useCallback(
    (worldId: string, objectId: string) => {
      fetch("/api/analytics/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          worldId,
          eventType: "interaction",
          objectId,
          deviceType: getDeviceType(),
        }),
      }).catch(() => {});
    },
    []
  );

  // Fetch world data
  useEffect(() => {
    fetch(`/api/worlds/public/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (body.empty) throw new Error("This world is still being built. Check back soon!");
          throw new Error("World not found");
        }
        return res.json();
      })
      .then((data: PublicWorldResponse) => {
        setWorldResponse(data);
        worldDataRef.current = data.publishedData;
        setSidePagePanelOpen(data.publishedData.sidePageConfig?.showByDefault ?? false);
        // Apply global wind config so the engine picks it up from localStorage
        if ((data as unknown as Record<string, unknown>).windConfig) {
          localStorage.setItem("dev-wind-config", JSON.stringify((data as unknown as Record<string, unknown>).windConfig));
        }
        trackView(data.worldId);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, trackView]);

  // Interaction handlers
  const handleInteraction = useCallback(
    (objectId: string) => {
      const obj = worldDataRef.current?.objects.find((o) => o.id === objectId);
      if (!obj) return;

      if (worldResponse) trackInteraction(worldResponse.worldId, objectId);

      // Handle interactable custom objects
      if (obj.payload.kind === "custom") {
        const payload = obj.payload as CustomObjectPayload;
        if (payload.billboard && payload.billboard.type !== "none") {
          if (payload.billboardClosable) {
            const current = billboardOpenOverridesRef.current[objectId] ?? (payload.billboardOpen ?? true);
            billboardOpenOverridesRef.current[objectId] = !current;
            setBillboardTick((n) => n + 1);
          }
          return;
        }
        const def = worldDataRef.current?.assets?.objects?.find((item) => item.id === payload.objectDefId);
        const isInteractable = def?.interactable ?? payload.interactable ?? false;
        if (isInteractable && payload.onClick) {
          if (payload.onClick.type === "openPageEditor" && payload.onClick.pageContent) {
            setActivePageContent(payload.onClick.pageContent);
            return;
          }
        }
      }

      if (obj.payload.kind === "link") {
        const url = obj.payload.url;
        if (isUrlSafe(url)) {
          window.open(url, obj.payload.openInNew ? "_blank" : "_self", "noopener,noreferrer");
        }
      } else {
        setActiveObj(obj);
      }
    },
    [worldResponse, trackInteraction]
  );

  const handleProximity = useCallback((objectId: string | null) => {
    if (!objectId) {
      setNearbyLabel(null);
      return;
    }
    const obj = worldDataRef.current?.objects.find((o) => o.id === objectId);
    setNearbyLabel(obj?.label ?? null);
  }, []);

  const handleMouseHover = useCallback((objectId: string | null) => {
    if (!objectId) {
      mouseHoveredObjRef.current = null;
      setMouseHoveredObj(null);
      return;
    }
    const obj = worldDataRef.current?.objects.find((o) => o.id === objectId) ?? null;
    mouseHoveredObjRef.current = obj;
    setMouseHoveredObj(obj);
  }, []);

  // Fired inside the engine's tick after transforms — same frame, no drift.
  const handleAfterFrame = useCallback(() => {
    const obj = mouseHoveredObjRef.current;
    const outer = overlayDivRef.current;
    const zoom = engineRef.current?.getCameraZoom() ?? 2.2;
    const effectiveScale = zoom;
    if (outer) {
      if (!obj) {
        outer.style.visibility = 'hidden';
      } else {
        const pos = engineRef.current?.getObjectScreenPosition(obj.id);
        if (!pos) {
          outer.style.visibility = 'hidden';
        } else {
          const p = obj.payload.kind === 'custom' ? obj.payload as CustomObjectPayload : null;
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

    const worldObjects = worldDataRef.current?.objects ?? [];
    for (const worldObj of worldObjects) {
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

      // Skip position calculation for objects outside the viewport
      const inView = engineRef.current?.isObjectInViewport(worldObj.id, 128) ?? false;
      if (!inView) {
        outer.style.visibility = "hidden";
        // Pause off-screen videos to save CPU/GPU
        const bVideo = billboardVideoRefs.current[worldObj.id];
        if (bVideo && !bVideo.paused) bVideo.pause();
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
        // Resume playback when scrolled back into view
        if (bVideo.paused) bVideo.play().catch(() => {});
      }
      const bText = billboardTextRefs.current[worldObj.id];
      if (bText) bText.style.fontSize = `${Math.max(11, Math.round(13 * effectiveScale))}px`;
    }
  }, []);

  // Init engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !worldDataRef.current) return;

    let disposed = false;
    const engine = new Engine({
      canvas,
      worldData: worldDataRef.current,
      onInteraction: handleInteraction,
      onInteractionProximity: handleProximity,
      onMouseHover: handleMouseHover,
      onAfterFrame: handleAfterFrame,
    });

    engine.init().then(() => {
      if (disposed) {
        engine.destroy();
        return;
      }
      engineRef.current = engine;
    }).catch(() => {
      if (!disposed) {
        setError("Failed to initialize world renderer");
      }
    });

    return () => {
      disposed = true;
      if (engineRef.current === engine) {
        engineRef.current.destroy();
      } else {
        engine.destroy();
      }
      engineRef.current = null;
    };
  }, [worldResponse, handleAfterFrame, handleInteraction, handleProximity, handleMouseHover]);

  const handleDirection = useCallback((x: number, y: number) => {
    engineRef.current?.setDirection(x, y);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateLayoutFlags = () => {
      setIsMobileViewport(window.innerWidth < 1024);
      setIsPortrait(window.matchMedia("(orientation: portrait)").matches);
    };

    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    updateLayoutFlags();
    onFullscreenChange();

    window.addEventListener("resize", updateLayoutFlags);
    window.addEventListener("orientationchange", updateLayoutFlags);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      window.removeEventListener("resize", updateLayoutFlags);
      window.removeEventListener("orientationchange", updateLayoutFlags);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const handleFullscreenToggle = useCallback(async () => {
    if (typeof document === "undefined") return;

    type ScreenOrientationLock =
      | "any"
      | "natural"
      | "landscape"
      | "portrait"
      | "portrait-primary"
      | "portrait-secondary"
      | "landscape-primary"
      | "landscape-secondary";

    const orientationApi = typeof screen !== "undefined"
      ? (screen.orientation as ScreenOrientation & {
          lock?: (orientation: ScreenOrientationLock) => Promise<void>;
          unlock?: () => void;
        })
      : null;

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        if (isMobileViewport && orientationApi?.lock) {
          await orientationApi.lock("landscape").catch(() => {});
        }
      } else {
        if (orientationApi?.unlock) {
          orientationApi.unlock();
        }
        await document.exitFullscreen();
      }
    } catch {
      // Ignore unsupported fullscreen/orientation APIs.
    }
  }, [isMobileViewport]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Loading world...</p>
        </div>
      </div>
    );
  }

  if (error || !worldResponse) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">World Not Found</h1>
          <p className="text-gray-400">{error || "This world doesn't exist or hasn't been published yet."}</p>
        </div>
      </div>
    );
  }

  const profile = worldResponse.profile;
  const showFreeBadge = profile?.showBranding === true;

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-950 relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ touchAction: "none", cursor: mouseHoveredObj ? "pointer" : "default" }}
        onMouseLeave={() => {
          mouseHoveredObjRef.current = null;
          setMouseHoveredObj(null);
        }}
      />

      {/* Creator profile corner */}
      {profile && (
        <div className="fixed top-3 left-3 z-30 flex items-center gap-2 bg-gray-900/90 px-3 py-2 rounded-full border border-gray-700">
          {profile.image && isUrlSafe(profile.image) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.image}
              alt={profile.displayName || profile.handle}
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="text-sm font-medium">{profile.displayName || profile.handle}</span>
        </div>
      )}

      {/* Hover overlay — always mounted; engine onAfterFrame sets position and sizes */}
      {(() => {
        const p = (mouseHoveredObj?.payload.kind === 'custom')
          ? mouseHoveredObj.payload as CustomObjectPayload
          : null;
        const onHover = (p?.onHover && p.onHover.type !== 'none') ? p.onHover : null;
        return (
          <div
            ref={overlayDivRef}
            className="fixed z-40 pointer-events-none"
            style={{ left: 0, top: 0, visibility: 'hidden', willChange: 'transform' }}
          >
            {onHover?.type === 'showText' && (
              <div
                ref={overlayTextRef}
                className="bg-gray-900/95 px-3 py-2 rounded-lg border border-gray-600 text-white max-w-[240px] text-center whitespace-pre-wrap"
                style={{ fontSize: 13 }}
              >
                {onHover.text}
              </div>
            )}
            {onHover?.type === 'showImage' && onHover.imageUrl && isUrlSafe(onHover.imageUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={overlayImgRef}
                src={onHover.imageUrl}
                alt=""
                className="block rounded-lg border-2 border-gray-600 object-contain"
              />
            )}
            {onHover?.type === 'showVideo' && onHover.videoUrl && isUrlSafe(onHover.videoUrl) && (
              <video
                ref={overlayVideoRef}
                src={onHover.videoUrl}
                autoPlay
                muted
                loop
                playsInline
                className="block rounded-lg border-2 border-gray-600 object-contain bg-black/80"
              />
            )}
          </div>
        );
      })()}

      {/* Billboard overlays — always on */}
      {(() => {
        const _tick = billboardTick;
        void _tick;
        const worldObjects = worldDataRef.current?.objects ?? [];
        return worldObjects
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
                className="fixed z-40"
                style={{
                  left: 0,
                  top: 0,
                  visibility: open ? "visible" : "hidden",
                  pointerEvents: p.billboardClosable ? "auto" : "none",
                  cursor: p.billboardClosable ? "pointer" : "default",
                  willChange: "transform",
                }}
              >
                {action.type === "showText" && (
                  <div
                    ref={(el) => { billboardTextRefs.current[o.id] = el; }}
                    className="bg-gray-900/95 px-3 py-2 rounded-lg border border-gray-600 text-white max-w-[240px] text-center whitespace-pre-wrap"
                    style={{ fontSize: 13 }}
                  >
                    {action.text}
                  </div>
                )}
                {action.type === "showImage" && action.imageUrl && isUrlSafe(action.imageUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    ref={(el) => { billboardImgRefs.current[o.id] = el; }}
                    src={action.imageUrl}
                    alt=""
                    className="block rounded-lg border-2 border-gray-600 object-contain"
                    style={{ backgroundColor: "rgba(0,0,0,0.22)", maxWidth: 150 * fallbackScale, maxHeight: 100 * fallbackScale }}
                  />
                )}
                {action.type === "showVideo" && action.videoUrl && isUrlSafe(action.videoUrl) && (
                  <video
                    ref={(el) => { billboardVideoRefs.current[o.id] = el; }}
                    src={action.videoUrl}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="block rounded-lg border-2 border-gray-600 object-contain bg-black/80"
                    style={{ maxWidth: 220 * fallbackScale, maxHeight: 140 * fallbackScale }}
                  />
                )}
              </div>
            );
          });
      })()}

      {/* Controls hint (desktop) */}
      <div className="fixed bottom-4 left-4 z-[45] hidden lg:block pointer-events-none">
        <div className="rounded-xl border border-white/12 bg-black/60 px-3 py-2 text-xs text-white/88 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          WASD / Arrow keys to move · Click on objects to interact
        </div>
      </div>

      {showFreeBadge && (
        <div className="fixed bottom-4 left-1/2 z-[45] -translate-x-1/2 pointer-events-none">
          <div className="rounded-full border border-white/12 bg-black/52 px-3 py-1.5 text-center text-[12px] text-white/88 shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-md">
            built with mypixel.page
          </div>
        </div>
      )}

      {isMobileViewport && isPortrait && (
        <div className="fixed right-4 top-14 z-[46] pointer-events-none">
          <div className="max-w-[54vw] rounded-full border border-white/16 bg-black/42 px-2.5 py-1 text-right text-[9px] leading-tight text-white/75 backdrop-blur-sm">
            Rotate phone horizontally for easier exploring
          </div>
        </div>
      )}

      <button
        className="fixed right-4 top-4 z-[46] rounded-full border border-white/25 bg-black/55 px-3 py-2 text-xs font-semibold tracking-wide text-white/95 backdrop-blur-md hover:bg-black/65 active:scale-[0.98]"
        onClick={handleFullscreenToggle}
        type="button"
      >
        {isFullscreen ? "Exit full" : "Full screen"}
      </button>

      {/* Mobile + tablet joystick */}
      <MobileJoystick onDir={handleDirection} />

      {/* Modal */}
      {activeObj && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setActiveObj(null)}
        >
          <div
            className="bg-gray-900 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-700"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {activeObj.payload.kind === "modal" && (
              <>
                <h2 className="text-xl font-bold mb-3">{activeObj.payload.title}</h2>
                <p className="text-gray-300 whitespace-pre-wrap">{activeObj.payload.body}</p>
              </>
            )}
            {activeObj.payload.kind === "media" && isUrlSafe(activeObj.payload.src) && (
              <>
                <h2 className="text-xl font-bold mb-3">{activeObj.label}</h2>
                {activeObj.payload.mediaType === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeObj.payload.src}
                    alt={activeObj.payload.alt}
                    className="w-full rounded-lg"
                    loading="lazy"
                  />
                ) : (
                  <video src={activeObj.payload.src} controls className="w-full rounded-lg" />
                )}
              </>
            )}
            <button
              onClick={() => setActiveObj(null)}
              className="mt-4 w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Page content viewer */}
      {activePageContent && (
        <PageViewerModal pageContent={activePageContent} onClose={() => setActivePageContent(null)} />
      )}

      {/* Side Page Panel */}
      <SidePagePanel
        config={worldResponse?.publishedData.sidePageConfig}
        isOpen={sidePagePanelOpen}
        onToggle={() => setSidePagePanelOpen(!sidePagePanelOpen)}
        onConfigChange={() => {
          // Config is read-only in public client, just toggle
        }}
        readOnly={true}
      />
    </div>
  );
}

// ─── Mobile Joystick ────────────────────────────────

function MobileJoystick({
  onDir,
}: {
  onDir: (x: number, y: number) => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0, active: false });

  const radius = 34;
  const deadZone = 8;
  const axisThreshold = 0.24;

  const resetStick = useCallback(() => {
    pointerIdRef.current = null;
    setThumb({ x: 0, y: 0, active: false });
    onDir(0, 0);
  }, [onDir]);

  const updateFromPoint = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) {
      const ratio = radius / distance;
      dx *= ratio;
      dy *= ratio;
    }

    setThumb({ x: dx, y: dy, active: true });

    if (Math.abs(dx) < deadZone && Math.abs(dy) < deadZone) {
      onDir(0, 0);
      return;
    }

    const nx = dx / radius;
    const ny = dy / radius;
    const sx = Math.abs(nx) >= axisThreshold ? Math.sign(nx) : 0;
    const sy = Math.abs(ny) >= axisThreshold ? Math.sign(ny) : 0;

    if (sx === 0 && sy === 0) {
      onDir(0, 0);
      return;
    }

    if (sx !== 0 && sy !== 0) {
      const invSqrt2 = Math.SQRT1_2;
      // Keep diagonal speed normalized while preserving clear facing axes.
      onDir(sx * invSqrt2, sy * invSqrt2);
      return;
    }

    onDir(sx, sy);
  }, [onDir, axisThreshold]);

  useEffect(() => {
    return () => {
      onDir(0, 0);
    };
  }, [onDir]);

  return (
    <div className="fixed bottom-6 left-6 z-40 lg:hidden select-none">
      <div
        ref={baseRef}
        className="relative h-24 w-24 rounded-full border border-white/15 bg-black/25 backdrop-blur-[2px]"
        style={{ touchAction: "none" }}
        onPointerDown={(e) => {
          pointerIdRef.current = e.pointerId;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          updateFromPoint(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          updateFromPoint(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          resetStick();
        }}
        onPointerCancel={(e) => {
          if (pointerIdRef.current !== e.pointerId) return;
          resetStick();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 rounded-full border border-white/20 bg-white/25 transition-transform duration-75"
          style={{
            transform: `translate(-50%, -50%) translate(${thumb.x}px, ${thumb.y}px)`,
            boxShadow: thumb.active ? "0 0 0 3px rgba(255,255,255,0.12)" : "none",
          }}
        />
      </div>
      <div className="mt-1 text-center text-[10px] font-semibold tracking-wide text-white/70">DRAG TO MOVE</div>
    </div>
  );
}
