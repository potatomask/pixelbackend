"use client";

import { useState, useEffect } from "react";
import { getAllTiles, initDevTiles } from "@mypixelpage/shared";
import type { TileDef } from "@mypixelpage/shared";

function loadCustomSources(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("dev-custom-tileset-sources") ?? "[]") as string[];
  } catch {
    return [];
  }
}

function loadObjectTilesetSources(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const objects = JSON.parse(localStorage.getItem("dev-objects") ?? "[]") as unknown[];
    return objects.flatMap((obj) => {
      if (!obj || typeof obj !== "object") return [];
      const typed = obj as { tilesetSrc?: unknown; variations?: Array<{ tilesetSrc?: unknown }> };
      const sources = [typed.tilesetSrc, ...(typed.variations ?? []).map((variation) => variation?.tilesetSrc)];
      return sources.filter((src): src is string => typeof src === "string" && src.length > 0);
    });
  } catch {
    return [];
  }
}

function loadAnimationTilesetSources(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const animations = JSON.parse(localStorage.getItem("dev-animations") ?? "[]") as unknown[];
    return animations
      .map((anim) => (anim && typeof anim === "object" ? (anim as { tilesetSrc?: unknown }).tilesetSrc : null))
      .filter((src): src is string => typeof src === "string" && src.length > 0);
  } catch {
    return [];
  }
}

/**
 * Loads all unique tileset PNG images referenced by registered tiles + dev sources.
 * Returns a Record mapping src URL → loaded HTMLImageElement.
 * Re-renders once when all images finish loading.
 */
export function useTilesetImages(): Record<string, HTMLImageElement> {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    initDevTiles();
    const srcs = new Set<string>();
    for (const t of getAllTiles()) {
      if (t.tilesetSrc) srcs.add(t.tilesetSrc);
      if (t.overlaySrc) srcs.add(t.overlaySrc);
    }
    for (const src of loadCustomSources()) srcs.add(src);
    for (const src of loadObjectTilesetSources()) srcs.add(src);
    for (const src of loadAnimationTilesetSources()) srcs.add(src);

    if (srcs.size === 0) {
      setImages({});
      return;
    }

    const loaded: Record<string, HTMLImageElement> = {};
    let remaining = srcs.size;

    const onDone = () => {
      remaining--;
      if (remaining <= 0) setImages({ ...loaded });
    };

    for (const src of srcs) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        loaded[src] = img;
        onDone();
      };
      img.onerror = onDone;
      img.src = src;
    }
  }, []);

  return images;
}
