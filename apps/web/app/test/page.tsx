"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Engine } from "@mypixelpage/runtime";
import type { WorldData, WorldObject } from "@mypixelpage/shared";

// ─── Hardcoded test world ────────────────────────────
function createTestWorld(): WorldData {
  const W = 20;
  const H = 15;

  // 3 layers: z0=water, z1=ground, z2=overlay
  const layers: number[][][] = Array.from({ length: 3 }, () =>
    Array.from({ length: H }, () => Array.from({ length: W }, () => 0))
  );

  // Layer 1 (ground): Fill a large grass area
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      layers[1]![y]![x] = 1; // grass
    }
  }

  // Layer 2 (overlay): Horizontal path
  for (let x = 2; x < W - 2; x++) {
    layers[2]![7]![x] = 3;
  }
  // Layer 2 (overlay): Vertical path
  for (let y = 2; y < H - 2; y++) {
    layers[2]![y]![10] = 3;
  }

  // Layer 0 (water): Water pond (top-left) — clear ground above it
  for (let y = 2; y < 5; y++) {
    for (let x = 2; x < 5; x++) {
      layers[0]![y]![x] = 4; // water
      layers[1]![y]![x] = 0; // remove ground so water is visible
    }
  }

  // Layer 1 (ground): Stone area (bottom-right)
  for (let y = 9; y < 13; y++) {
    for (let x = 14; x < 18; x++) {
      layers[1]![y]![x] = 2; // stone
    }
  }

  // Layer 1 (ground): Gravel patch (top-right)
  for (let y = 2; y < 5; y++) {
    for (let x = 15; x < 18; x++) {
      layers[1]![y]![x] = 5; // gravel
    }
  }

  const objects: WorldObject[] = [
    {
      id: "obj-1",
      type: "modal",
      gridX: 5,
      gridY: 4,
      label: "About Me",
      payload: {
        kind: "modal",
        title: "Welcome!",
        body: "This is a demo world. I'm a creator building cool stuff!",
      },
      cooldownMs: 500,
    },
    {
      id: "obj-2",
      type: "link",
      gridX: 7,
      gridY: 5,
      label: "My Website",
      payload: {
        kind: "link",
        url: "https://example.com",
        openInNew: true,
      },
      cooldownMs: 500,
    },
    {
      id: "obj-3",
      type: "media",
      gridX: 9,
      gridY: 3,
      label: "My Photo",
      payload: {
        kind: "media",
        src: "https://picsum.photos/400/300",
        alt: "A sample photo",
        mediaType: "image",
      },
      cooldownMs: 500,
    },
  ];

  return {
    version: 2,
    gridWidth: W,
    gridHeight: H,
    spawnX: 10,
    spawnY: 7,
    layers,
    objects,
  };
}

// ─── Interaction Modal ──────────────────────────────

function InteractionModal({
  obj,
  onClose,
}: {
  obj: WorldObject;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {obj.payload.kind === "modal" && (
          <>
            <h2 className="text-xl font-bold mb-3">{obj.payload.title}</h2>
            <p className="text-gray-300 whitespace-pre-wrap">{obj.payload.body}</p>
          </>
        )}

        {obj.payload.kind === "link" && (
          <>
            <h2 className="text-xl font-bold mb-3">{obj.label}</h2>
            <a
              href={obj.payload.url}
              target={obj.payload.openInNew ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline break-all"
            >
              {obj.payload.url}
            </a>
          </>
        )}

        {obj.payload.kind === "media" && (
          <>
            <h2 className="text-xl font-bold mb-3">{obj.label}</h2>
            {obj.payload.mediaType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={obj.payload.src}
                alt={obj.payload.alt}
                className="w-full rounded-lg"
                loading="lazy"
              />
            ) : (
              <video
                src={obj.payload.src}
                controls
                className="w-full rounded-lg"
              />
            )}
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Mobile D-Pad ───────────────────────────────────

function MobileDPad({
  onDirection,
  onInteract,
}: {
  onDirection: (x: number, y: number) => void;
  onInteract: () => void;
}) {
  const handleTouchStart = (x: number, y: number) => (e: React.TouchEvent) => {
    e.preventDefault();
    onDirection(x, y);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    onDirection(0, 0);
  };

  return (
    <>
      {/* D-Pad */}
      <div className="fixed bottom-8 left-8 z-40 grid grid-cols-3 gap-1 md:hidden">
        <div />
        <button
          className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center active:bg-white/40 select-none"
          onTouchStart={handleTouchStart(0, -1)}
          onTouchEnd={handleTouchEnd}
        >
          ▲
        </button>
        <div />
        <button
          className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center active:bg-white/40 select-none"
          onTouchStart={handleTouchStart(-1, 0)}
          onTouchEnd={handleTouchEnd}
        >
          ◀
        </button>
        <div />
        <button
          className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center active:bg-white/40 select-none"
          onTouchStart={handleTouchStart(1, 0)}
          onTouchEnd={handleTouchEnd}
        >
          ▶
        </button>
        <div />
        <button
          className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center active:bg-white/40 select-none"
          onTouchStart={handleTouchStart(0, 1)}
          onTouchEnd={handleTouchEnd}
        >
          ▼
        </button>
        <div />
      </div>

      {/* Interact button */}
      <button
        className="fixed bottom-12 right-8 z-40 w-16 h-16 bg-blue-600/70 rounded-full flex items-center justify-center text-white font-bold text-lg active:bg-blue-500 md:hidden select-none"
        onTouchStart={(e) => {
          e.preventDefault();
          onInteract();
        }}
      >
        E
      </button>
    </>
  );
}

// ─── Test Page Component ────────────────────────────

export default function TestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [activeObj, setActiveObj] = useState<WorldObject | null>(null);
  const [nearbyLabel, setNearbyLabel] = useState<string | null>(null);
  const worldDataRef = useRef(createTestWorld());

  const handleInteraction = useCallback((objectId: string) => {
    const obj = worldDataRef.current.objects.find((o) => o.id === objectId);
    if (obj) setActiveObj(obj);
  }, []);

  const handleProximity = useCallback((objectId: string | null) => {
    if (!objectId) {
      setNearbyLabel(null);
      return;
    }
    const obj = worldDataRef.current.objects.find((o) => o.id === objectId);
    setNearbyLabel(obj?.label ?? null);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine({
      canvas,
      worldData: worldDataRef.current,
      onInteraction: handleInteraction,
      onInteractionProximity: handleProximity,
    });

    engine.init().then(() => {
      engineRef.current = engine;
    });

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [handleInteraction, handleProximity]);

  const handleDirection = useCallback((x: number, y: number) => {
    engineRef.current?.setDirection(x, y);
  }, []);

  const handleMobileInteract = useCallback(() => {
    engineRef.current?.triggerInteraction();
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-950 relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ touchAction: "none" }}
      />

      {/* Interaction prompt */}
      {nearbyLabel && !activeObj && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 bg-gray-900/90 px-4 py-2 rounded-full text-sm border border-gray-600">
          <span className="text-gray-400">Press </span>
          <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono">E</kbd>
          <span className="text-gray-400"> to interact with </span>
          <span className="text-white font-medium">{nearbyLabel}</span>
        </div>
      )}

      {/* Controls hint (desktop) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 text-xs text-gray-500 hidden md:block">
        WASD / Arrow keys to move · E / Space to interact
      </div>

      {/* Mobile controls */}
      <MobileDPad onDirection={handleDirection} onInteract={handleMobileInteract} />

      {/* Interaction modal */}
      {activeObj && (
        <InteractionModal obj={activeObj} onClose={() => setActiveObj(null)} />
      )}
    </div>
  );
}
