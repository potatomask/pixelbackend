"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import type { SidePageConfig, SidePageLink, SidePageTheme, ThemeSpriteRef, NineSliceTiles, SidePageFont } from "@mypixelpage/shared";
import { TILESET_TILE_SIZE, isUrlSafe } from "@mypixelpage/shared";
import { Link2, Settings2, Plus, Trash2, GripVertical, ExternalLink, Palette, Type, Eye, Pencil, ChevronRight, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Paintbrush, X } from "lucide-react";
import { T } from "./theme";
import { useEditorStore } from "../store";

/* ── Theme loader ───────────────────────────────── */
const THEME_STORAGE_KEY = "dev-sidepage-themes";
const USER_THEME_KEY = "user-selected-theme-id";

const FONT_OPTIONS: { value: SidePageFont; label: string }[] = [
  { value: "system", label: "System" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
  { value: "pixel", label: "Pixel" },
  { value: "rounded", label: "Rounded" },
  { value: "tiny5", label: "Tiny5" },
  { value: "bytesized", label: "Bytesized" },
];

function getSidePageFontFamily(font?: SidePageFont): string {
  if (font === "serif") return "Georgia, 'Times New Roman', serif";
  if (font === "monospace") return "'Courier New', Courier, monospace";
  if (font === "pixel") return "'Press Start 2P', monospace";
  if (font === "rounded") return "'Varela Round', 'Trebuchet MS', sans-serif";
  if (font === "tiny5") return "var(--font-tiny5), monospace";
  if (font === "bytesized") return "var(--font-bytesized), 'Courier New', monospace";
  return "system-ui, -apple-system, sans-serif";
}

function loadAllThemes(): SidePageTheme[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/* ── Theme sync from server ──────────────────────── */
async function loadThemesFromServer(): Promise<void> {
  try {
    const res = await fetch(`/api/settings/${encodeURIComponent(THEME_STORAGE_KEY)}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { value: string | null };
    if (data.value != null) {
      localStorage.setItem(THEME_STORAGE_KEY, data.value);
    }
  } catch {
    // silent fail — localStorage is the fallback
  }
}

/** Resolve the active theme: user-chosen > editor-default > first */
function loadActiveTheme(): SidePageTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const themes = loadAllThemes();
    if (themes.length === 0) return null;
    const userId = localStorage.getItem(USER_THEME_KEY);
    if (userId) {
      const userTheme = themes.find((t) => t.id === userId);
      if (userTheme) return userTheme;
    }
    return themes.find((t) => t.isDefault) ?? themes[0] ?? null;
  } catch {
    return null;
  }
}

/* ── 9-Slice Canvas Background ──────────────────── */
function NineSliceBg({
  theme,
  width,
  height,
  overflowPx = 0,
  designScale = 1,
  designOffsetXPx = 0,
  designOffsetYPx = 0,
}: {
  theme: SidePageTheme;
  width: number;
  height: number;
  overflowPx?: number;
  designScale?: number;
  designOffsetXPx?: number;
  designOffsetYPx?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawW = width + overflowPx * 2;
  const drawH = height + overflowPx * 2;

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs || drawW <= 0 || drawH <= 0) return;
    cvs.width = drawW;
    cvs.height = drawH;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, drawW, drawH);

    const t = theme.tiles;
    const ts = TILESET_TILE_SIZE;

    // Collect unique tileset sources
    const sources = new Set<string>();
    for (const ref of Object.values(t)) {
      if (ref?.src) sources.add(ref.src);
    }

    // Load all tileset images, then draw
    const imgMap = new Map<string, HTMLImageElement>();
    let loaded = 0;
    const total = sources.size;
    if (total === 0) return;

    sources.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        imgMap.set(src, img);
        loaded++;
        if (loaded === total) drawNineSlice(ctx, t, imgMap, ts, drawW, drawH);
      };
      img.onerror = () => {
        loaded++;
        if (loaded === total) drawNineSlice(ctx, t, imgMap, ts, drawW, drawH);
      };
      img.src = src;
    });
  }, [theme, drawW, drawH]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: -overflowPx,
        left: -overflowPx,
        width: `calc(100% + ${overflowPx * 2}px)`,
        height: `calc(100% + ${overflowPx * 2}px)`,
        imageRendering: "pixelated",
        pointerEvents: "none",
        zIndex: 0,
        transform: `translate(${designOffsetXPx}px, ${designOffsetYPx}px) scale(${designScale})`,
        transformOrigin: "center center",
      }}
    />
  );
}

function drawSlice(
  ctx: CanvasRenderingContext2D,
  imgMap: Map<string, HTMLImageElement>,
  ref: ThemeSpriteRef | undefined,
  ts: number,
  dx: number, dy: number, dw: number, dh: number,
) {
  if (!ref?.src) return;
  const img = imgMap.get(ref.src);
  if (!img) return;
  const sw = (ref.widthTiles ?? 1) * ts;
  const sh = (ref.heightTiles ?? 1) * ts;
  ctx.drawImage(img, ref.x, ref.y, sw, sh, dx, dy, dw, dh);
}

function drawNineSlice(
  ctx: CanvasRenderingContext2D,
  tiles: NineSliceTiles,
  imgMap: Map<string, HTMLImageElement>,
  ts: number,
  w: number,
  h: number,
  edgeOverride?: number,
) {
  const edge = edgeOverride ?? ts * (tiles.center?.scale ?? 3);
  const innerW = Math.max(0, w - edge * 2);
  const innerH = Math.max(0, h - edge * 2);

  // Corners
  drawSlice(ctx, imgMap, tiles.topLeft, ts, 0, 0, edge, edge);
  drawSlice(ctx, imgMap, tiles.topRight, ts, w - edge, 0, edge, edge);
  drawSlice(ctx, imgMap, tiles.bottomLeft, ts, 0, h - edge, edge, edge);
  drawSlice(ctx, imgMap, tiles.bottomRight, ts, w - edge, h - edge, edge, edge);

  // Edges (stretched)
  drawSlice(ctx, imgMap, tiles.top, ts, edge, 0, innerW, edge);
  drawSlice(ctx, imgMap, tiles.bottom, ts, edge, h - edge, innerW, edge);
  drawSlice(ctx, imgMap, tiles.left, ts, 0, edge, edge, innerH);
  drawSlice(ctx, imgMap, tiles.right, ts, w - edge, edge, edge, innerH);

  // Center (stretched to fill)
  drawSlice(ctx, imgMap, tiles.center, ts, edge, edge, innerW, innerH);
}

/* ── Button Sprite Icon ─────────────────────────── */
function ButtonSpriteIcon({
  bg,
  icon,
  fallback,
  size,
}: {
  bg?: NineSliceTiles;
  icon?: ThemeSpriteRef;
  fallback: React.ReactNode;
  size: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasBg = bg != null && Object.values(bg).some((v) => v?.src);
  const hasIcon = !!icon?.src;

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    const sources = new Set<string>();
    if (bg) {
      for (const ref of Object.values(bg)) {
        if (ref?.src) sources.add(ref.src);
      }
    }
    if (icon?.src) sources.add(icon.src);
    if (sources.size === 0) return;

    const imgMap = new Map<string, HTMLImageElement>();
    let loaded = 0;
    const total = sources.size;

    sources.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        imgMap.set(src, img);
        loaded++;
        if (loaded === total) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, size, size);
          // Draw 9-slice bg
          if (bg) {
            const edge = Math.floor(size / 3);
            drawNineSlice(ctx, bg, imgMap, TILESET_TILE_SIZE, size, size, edge);
          }
          // Draw icon on top
          if (icon?.src) {
            const icImg = imgMap.get(icon.src);
            if (icImg) {
              const iw = (icon.widthTiles ?? 1) * TILESET_TILE_SIZE;
              const ih = (icon.heightTiles ?? 1) * TILESET_TILE_SIZE;
              const padding = Math.round(size * 0.15);
              const baseBox = Math.max(0, size - padding * 2);
              const aspect = iw / ih;
              let dw = baseBox;
              let dh = baseBox;
              if (aspect > 1) {
                dh = baseBox / aspect;
              } else {
                dw = baseBox * aspect;
              }
              const iconScale = icon.scale ?? 1;
              dw *= iconScale;
              dh *= iconScale;
              const dx = (size - dw) / 2;
              const dy = (size - dh) / 2;
              ctx.drawImage(icImg, icon.x, icon.y, iw, ih, dx, dy, dw, dh);
            }
          }
        }
      };
      img.src = src;
    });
  }, [bg, icon, size]);

  if (!hasBg && !hasIcon) return <>{fallback}</>;

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: "block", imageRendering: "pixelated" }}
    />
  );
}

interface SidePagePanelProps {
  config: SidePageConfig | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onConfigChange?: (config: SidePageConfig) => void;
  readOnly?: boolean;
  position?: "fixed" | "absolute";
}

const DEFAULT_CONFIG: SidePageConfig = {
  enabled: true,
  headerText: "Links",
  headerBold: false,
  headerItalic: false,
  headerAlign: "left",
  links: [],
  backgroundColor: "#f8fafc",
  textColor: "#0f172a",
  linkColor: "#2563eb",
  showByDefault: false,
};

export const SidePagePanel: React.FC<SidePagePanelProps> = ({
  config = DEFAULT_CONFIG,
  isOpen,
  onToggle,
  onConfigChange,
  readOnly = false,
  position = "fixed",
}) => {
  const [tab, setTab] = useState<"links" | "settings" | "theme">("links");
  const activeTab: "links" | "settings" | "theme" = readOnly ? "links" : tab;
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkImageUrl, setLinkImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);

  // 9-slice theme
  const [theme, setTheme] = useState<SidePageTheme | null>(null);
  const [allThemes, setAllThemes] = useState<SidePageTheme[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [panelSize, setPanelSize] = useState({ w: 0, h: 0 });
  const [viewportSize, setViewportSize] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 1200,
    h: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  useEffect(() => {
    const applyThemes = (themes: SidePageTheme[]) => {
      setAllThemes(themes);
      if (themes.length === 0) { setTheme(null); return; }
      const userChoiceId = localStorage.getItem(USER_THEME_KEY);
      // Only honour the stored choice if the user explicitly picked it
      const userTheme = userChoiceId ? themes.find((t) => t.id === userChoiceId) : null;
      setTheme(userTheme ?? themes.find((t) => t.isDefault) ?? themes[0] ?? null);
    };

    // Always fetch the latest global themes from the server so the admin's
    // current isDefault flag is respected for every user (old or new worlds).
    // Bundled themes in the published world data are only used as a fallback
    // when the server fetch fails.
    loadThemesFromServer().then(() => {
      const serverThemes = loadAllThemes();
      if (serverThemes.length > 0) {
        applyThemes(serverThemes);
      } else {
        // Server returned nothing — fall back to bundled themes
        applyThemes(config.themes ?? []);
      }
    });
  }, [readOnly, config.themes]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPanelSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const mergeButtonBg = (btn: "link" | "settings" | "theme"): NineSliceTiles | undefined => {
    if (!theme) return undefined;
    const cfg = btn === "theme" ? theme.buttons.theme : theme.buttons[btn];
    if (!cfg) return undefined;
    if (cfg.inheritMainFrameBg) {
      return { ...theme.tiles, ...(cfg.bg ?? {}) };
    }
    return cfg.bg;
  };

  const linkBg = mergeButtonBg("link");
  const settingsBg = mergeButtonBg("settings");
  const themeBg = mergeButtonBg("theme");

  const hasThemeTiles = theme != null && Object.values(theme.tiles).some((v) => v?.src);
  const hasLinkBtnSprites = theme != null && (
    (linkBg != null && Object.values(linkBg).some((v) => v?.src)) ||
    !!theme.buttons.link.icon?.src
  );
  const hasSettingsBtnSprites = theme != null && (
    (settingsBg != null && Object.values(settingsBg).some((v) => v?.src)) ||
    !!theme.buttons.settings.icon?.src
  );
  const hasThemeBtnSprites = theme != null && (
    (themeBg != null && Object.values(themeBg).some((v) => v?.src)) ||
    !!theme.buttons.theme?.icon?.src
  );
  const contentInsetPx = 16;
  const visualOverflowPx = Math.max(0, Math.min(80, theme?.visualOverflowPx ?? 0));
  const designScale = Math.max(0.8, Math.min(2, theme?.designScale ?? 1));
  const designOffsetXPx = Math.max(-80, Math.min(80, theme?.designOffsetXPx ?? 0));
  const designOffsetYPx = Math.max(-80, Math.min(80, theme?.designOffsetYPx ?? 0));
  const needsVisibleOverflow =
    visualOverflowPx > 0 ||
    Math.abs(designScale - 1) > 0.001 ||
    designOffsetXPx !== 0 ||
    designOffsetYPx !== 0;

  const baseScreenInset = 12;
  const estimatedPanelW = panelSize.w > 0 ? panelSize.w : 334;
  const estimatedPanelH = panelSize.h > 0 ? panelSize.h : Math.max(320, Math.floor(viewportSize.h * 0.72));
  const drawW = estimatedPanelW + visualOverflowPx * 2;
  const drawH = estimatedPanelH + visualOverflowPx * 2;
  const transformedHalfW = (drawW * designScale) / 2;
  const transformedHalfH = (drawH * designScale) / 2;
  const transformedLeft = estimatedPanelW / 2 + designOffsetXPx - transformedHalfW;
  const transformedRight = estimatedPanelW / 2 + designOffsetXPx + transformedHalfW;
  const transformedTop = estimatedPanelH / 2 + designOffsetYPx - transformedHalfH;
  const transformedBottom = estimatedPanelH / 2 + designOffsetYPx + transformedHalfH;
  const spillLeft = Math.max(0, -transformedLeft);
  const spillRight = Math.max(0, transformedRight - estimatedPanelW);
  const spillTop = Math.max(0, -transformedTop);
  const spillBottom = Math.max(0, transformedBottom - estimatedPanelH);

  const dynamicRight = Math.round(baseScreenInset + spillRight);
  const dynamicTop = Math.round(baseScreenInset + spillTop);
  const maxPanelWidth = Math.max(0, viewportSize.w - (baseScreenInset * 2 + spillLeft + spillRight));
  const dynamicWidth = Math.min(334, maxPanelWidth);
  const dynamicMaxHeight = Math.max(0, viewportSize.h - (baseScreenInset * 2 + spillTop + spillBottom));
  const isReadOnlyMobile = readOnly && viewportSize.w < 768;
  const mobileWidth = Math.min(dynamicWidth, Math.max(260, viewportSize.w - 24));
  const mobileMaxHeight = Math.max(280, Math.min(dynamicMaxHeight, Math.floor(viewportSize.h * 0.82)));
  const selectedFont = (config.font ?? "system") as SidePageFont;

  const handleAddLink = useCallback(() => {
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    
    // Trim and normalize URL: add https:// if no protocol is specified
    const trimmedUrl = linkUrl.trim();
    const normalizedUrl = trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")
      ? trimmedUrl
      : `https://${trimmedUrl}`;
    
    const cleanTitle = linkTitle.trim();

    // Validate URL before storing — block javascript:, data:, etc.
    if (!isUrlSafe(normalizedUrl)) return;
    const cleanImageUrl = linkImageUrl.trim() || undefined;
    
    if (editingLinkId) {
      // Update existing link
      const updated = config.links.map((l) =>
        l.id === editingLinkId ? { ...l, title: cleanTitle, url: normalizedUrl, imageUrl: cleanImageUrl } : l
      );
      onConfigChange?.({ ...config, links: updated });
      setEditingLinkId(null);
    } else {
      // Add new link
      const newLink: SidePageLink = {
        id: `link-${Date.now()}`,
        title: cleanTitle,
        url: normalizedUrl,
        order: config.links.length,
        ...(cleanImageUrl ? { imageUrl: cleanImageUrl } : {}),
      };
      onConfigChange?.({
        ...config,
        links: [...config.links, newLink],
      });
    }
    setLinkTitle("");
    setLinkUrl("");
    setLinkImageUrl("");
  }, [config, linkTitle, linkUrl, linkImageUrl, editingLinkId, onConfigChange]);

  const handleImageUpload = useCallback(async (file: File) => {
    setIsUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/media/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { url: string };
      setLinkImageUrl(data.url);
    } catch {
      // silently ignore — user can retry
    } finally {
      setIsUploadingImage(false);
    }
  }, []);

  const handleEditLink = (link: SidePageLink) => {
    setEditingLinkId(link.id);
    setLinkTitle(link.title);
    setLinkUrl(link.url);
    setLinkImageUrl(link.imageUrl || "");
  };

  const handleCancelEdit = () => {
    setEditingLinkId(null);
    setLinkTitle("");
    setLinkUrl("");
    setLinkImageUrl("");
  };

  const handleSelectTheme = useCallback((id: string) => {
    // Free-tier restriction: only themes marked freeTierOk are allowed
    const target = allThemes.find((t) => t.id === id);
    if (target && useEditorStore.getState().userTier === "FREE" && target.freeTierOk === false) return;
    // Store user's choice separately — never mutate the editor's isDefault flag
    localStorage.setItem(USER_THEME_KEY, id);
    const selected = target ?? null;
    setTheme(selected);
  }, [allThemes]);

  const handleDeleteLink = useCallback(
    (id: string) => {
      const updatedLinks = config.links
        .filter((link) => link.id !== id)
        .map((link, idx) => ({ ...link, order: idx }));
      onConfigChange?.({
        ...config,
        links: updatedLinks,
      });
    },
    [config, onConfigChange]
  );

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const draggedIdx = config.links.findIndex((l) => l.id === draggedId);
    const targetIdx = config.links.findIndex((l) => l.id === targetId);
    const newLinks = [...config.links];
    const [removed] = newLinks.splice(draggedIdx, 1);
    newLinks.splice(targetIdx, 0, removed!);
    const reordered = newLinks.map((link, idx) => ({ ...link, order: idx }));
    onConfigChange?.({
      ...config,
      links: reordered,
    });
    setDraggedId(null);
  };

  const handleColorChange = (key: "backgroundColor" | "textColor" | "linkColor", value: string) => {
    onConfigChange?.({
      ...config,
      [key]: value,
    });
  };

  const handleToggle = () => {
    onToggle();
  };

  return (
    <div
      style={{
        position,
        right: isReadOnlyMobile ? "auto" : `${dynamicRight}px`,
        left: isReadOnlyMobile ? "50%" : undefined,
        top: isReadOnlyMobile ? "50%" : dynamicTop,
        zIndex: 1000,
        width: `${isReadOnlyMobile ? mobileWidth : dynamicWidth}px`,
        maxHeight: `${isReadOnlyMobile ? mobileMaxHeight : dynamicMaxHeight}px`,
        paddingBottom: 8,
        display: "flex",
        flexDirection: "column",
        transform: isReadOnlyMobile
          ? (isOpen ? "translate(-50%, -50%)" : "translate(-50%, calc(100% + 24px))")
          : (isOpen ? "translateX(0)" : "translateX(calc(100% + 24px))"),
        transition: "transform 340ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* Button Rail */}
      <div
        style={{
          position: "absolute",
          left: isReadOnlyMobile ? "50%" : "-50px",
          top: isReadOnlyMobile ? "100%" : 10,
          transform: isReadOnlyMobile ? "translate(-50%, 10px)" : undefined,
          display: "flex",
          flexDirection: isReadOnlyMobile ? "row" : "column",
          alignItems: "flex-end",
          gap: 8,
          zIndex: 5,
        }}
      >
        {/* Link Button */}
        <button
          onClick={handleToggle}
          data-tour-sidebar-toggle-button
          style={{
            width: "50px",
            height: "50px",
            borderRadius: hasLinkBtnSprites ? 0 : (isReadOnlyMobile ? "14px" : "14px 0 0 14px"),
            background: hasLinkBtnSprites ? "transparent" : "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
            borderTop: hasLinkBtnSprites ? "none" : "1px solid rgba(37,99,235,0.7)",
            borderBottom: hasLinkBtnSprites ? "none" : "1px solid rgba(37,99,235,0.7)",
            borderLeft: hasLinkBtnSprites ? "none" : "1px solid rgba(37,99,235,0.7)",
            borderRight: isReadOnlyMobile ? (hasLinkBtnSprites ? "none" : "1px solid rgba(37,99,235,0.7)") : "none",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.15s ease, filter 0.2s ease",
            overflow: "hidden",
            padding: 0,
            opacity: isReadOnlyMobile && isOpen ? 0 : 1,
            pointerEvents: isReadOnlyMobile && isOpen ? "none" : "auto",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.filter = "brightness(1.06)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.filter = "brightness(1)";
          }}
          aria-label={isOpen ? "Close side page" : "Open side page"}
        >
          <ButtonSpriteIcon
            bg={linkBg}
            icon={theme?.buttons.link.icon}
            size={50}
            fallback={<Link2 size={20} strokeWidth={2.4} />}
          />
        </button>

        {!readOnly && (
          <button
            onClick={() => setTab((prev) => prev === "settings" ? "links" : "settings")}
            title={tab === "settings" ? "Show links" : "Open settings"}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: hasSettingsBtnSprites ? 0 : "10px 0 0 10px",
              borderTop: hasSettingsBtnSprites ? "none" : "1px solid rgba(100,116,139,0.35)",
              borderBottom: hasSettingsBtnSprites ? "none" : "1px solid rgba(100,116,139,0.35)",
              borderLeft: hasSettingsBtnSprites ? "none" : "1px solid rgba(100,116,139,0.35)",
              borderRight: "none",
              backgroundColor: hasSettingsBtnSprites ? "transparent" : (tab === "settings" ? "#334155" : "#64748b"),
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: isOpen ? 1 : 0,
              pointerEvents: isOpen ? "auto" : "none",
              transition: "opacity 180ms ease",
              overflow: "hidden",
              padding: 0,
            }}
            aria-label={tab === "settings" ? "Show links tab" : "Show settings tab"}
          >
            <ButtonSpriteIcon
              bg={settingsBg}
              icon={theme?.buttons.settings.icon}
              size={36}
              fallback={<Settings2 size={16} strokeWidth={2.2} />}
            />
          </button>
        )}

        {!readOnly && (
          <button
            onClick={() => setTab((prev) => prev === "theme" ? "links" : "theme")}
            title={tab === "theme" ? "Show links" : "Choose theme"}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: hasThemeBtnSprites ? 0 : "10px 0 0 10px",
              borderTop: hasThemeBtnSprites ? "none" : "1px solid rgba(100,116,139,0.35)",
              borderBottom: hasThemeBtnSprites ? "none" : "1px solid rgba(100,116,139,0.35)",
              borderLeft: hasThemeBtnSprites ? "none" : "1px solid rgba(100,116,139,0.35)",
              borderRight: "none",
              backgroundColor: hasThemeBtnSprites ? "transparent" : (tab === "theme" ? "#334155" : "#64748b"),
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: isOpen ? 1 : 0,
              pointerEvents: isOpen ? "auto" : "none",
              transition: "opacity 180ms ease",
              overflow: "hidden",
              padding: 0,
            }}
            aria-label={tab === "theme" ? "Show links tab" : "Show theme tab"}
          >
            <ButtonSpriteIcon
              bg={themeBg}
              icon={theme?.buttons.theme?.icon}
              size={36}
              fallback={<Paintbrush size={16} strokeWidth={2.2} />}
            />
          </button>
        )}
      </div>

      {/* Side Panel */}
      <div
        ref={panelRef}
        style={{
          position: "relative",
          width: "100%",
          flex: 1,
          minHeight: 0,
          backgroundColor: hasThemeTiles ? "transparent" : (config.backgroundColor || "#f5f5f5"),
          color: config.textColor || "#333333",
          borderRadius: 0,
          display: "flex",
          flexDirection: "column",
          overflow: needsVisibleOverflow ? "visible" : "hidden",
          fontFamily: getSidePageFontFamily(selectedFont),
          zIndex: 2,
          border: hasThemeTiles ? "none" : "1px solid rgba(148,163,184,0.35)", // Unified borders on all sides
          backdropFilter: hasThemeTiles ? undefined : "blur(6px)",
        }}
      >
          {hasThemeTiles && theme && panelSize.w > 0 && (
            <NineSliceBg
              theme={theme}
              width={panelSize.w}
              height={panelSize.h}
              overflowPx={visualOverflowPx}
              designScale={designScale}
              designOffsetXPx={designOffsetXPx}
              designOffsetYPx={designOffsetYPx}
            />
          )}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              padding: `${contentInsetPx + 2}px ${readOnly && isReadOnlyMobile ? contentInsetPx + 34 : contentInsetPx}px ${Math.max(8, contentInsetPx - 2)}px ${contentInsetPx}px`,
              borderBottom: hasThemeTiles ? "none" : "1px solid rgba(148,163,184,0.22)",
              background: hasThemeTiles ? "transparent" : "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.15) 100%)",
            }}
          >
            {readOnly && isReadOnlyMobile && isOpen && (
              <button
                type="button"
                onClick={handleToggle}
                style={{
                  position: "absolute",
                  right: 10,
                  top: 10,
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: "1px solid rgba(148,163,184,0.35)",
                  background: "rgba(15,23,42,0.7)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                aria-label="Close side page"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            )}
            {activeTab === "settings" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Settings2 size={14} strokeWidth={2.2} style={{ opacity: 0.6 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>Settings</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.55, marginTop: 3, marginLeft: 20 }}>Customize appearance</div>
              </>
            ) : activeTab === "theme" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Paintbrush size={14} strokeWidth={2.2} style={{ opacity: 0.6 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.2 }}>Theme</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.55, marginTop: 3, marginLeft: 20 }}>Choose a panel theme</div>
              </>
            ) : (
              <>
                {!readOnly && editingHeader ? (
                  <input
                    autoFocus
                    type="text"
                    value={config.headerText || ""}
                    onChange={(e) => onConfigChange?.({ ...config, headerText: e.target.value })}
                    onBlur={() => setEditingHeader(false)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingHeader(false)}
                    style={{
                      fontSize: 20,
                      fontWeight: config.headerBold ? 900 : 700,
                      fontStyle: config.headerItalic ? "italic" : "normal",
                      textAlign: (config.headerAlign || "left") as any,
                      border: "none",
                      borderBottom: `2px solid ${config.linkColor || "#2563eb"}`,
                      background: "transparent",
                      color: config.linkColor || "#2563eb",
                      outline: "none",
                      padding: "2px 0",
                      width: "100%",
                      letterSpacing: 0.3,
                      lineHeight: 1.2,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      cursor: readOnly ? "default" : "pointer",
                      textAlign: (config.headerAlign || "left") as any,
                    }}
                    onClick={() => !readOnly && setEditingHeader(true)}
                  >
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: config.headerBold ? 900 : 700,
                        fontStyle: config.headerItalic ? "italic" : "normal",
                        letterSpacing: 0.3,
                        color: config.textColor || "#0f172a",
                        lineHeight: 1.2,
                        display: "inline-block",
                      }}
                    >
                      {config.headerText?.trim() || "Links"}
                      {!readOnly && (config.headerAlign || "left") === "left" && (
                        <Pencil size={14} strokeWidth={2} style={{ marginLeft: 6, opacity: 0.4, verticalAlign: "middle" }} />
                      )}
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4, fontWeight: 500, textAlign: (config.headerAlign || "left") as any }}>
                  {config.links.length} link{config.links.length !== 1 ? "s" : ""}
                </div>
              </>
            )}
          </div>

          {/* Content */}
          <style dangerouslySetInnerHTML={{__html: `
            .sidepage-scroll-container::-webkit-scrollbar { display: none; }
            .sidepage-scroll-container { scrollbar-width: none; -ms-overflow-style: none; }
          `}} />
          <div
            className="sidepage-scroll-container"
            style={{
              position: "relative",
              zIndex: 1,
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              padding: `${contentInsetPx}px`,
              paddingBottom: "160px", // Generous bottom padding to allow scrolling well past the frame bottom
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 14px, black calc(100% - 130px), transparent calc(100% - 60px))",
              maskImage: "linear-gradient(to bottom, transparent 0px, black 14px, black calc(100% - 130px), transparent calc(100% - 60px))",
            }}
          >
            {activeTab === "links" ? (
              <>
                {/* Links List */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {config.links.length === 0 && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "20px 12px",
                        opacity: 0.45,
                        fontSize: 12,
                        lineHeight: 1.6,
                      }}
                    >
                      <Link2 size={24} strokeWidth={1.5} style={{ marginBottom: 6, opacity: 0.5 }} />
                      <div>{readOnly ? "No links yet" : "Add your first link below"}</div>
                    </div>
                  )}

                  {config.links.map((link) => (
                    <div
                      key={link.id}
                      draggable={!readOnly}
                      onDragStart={() => !readOnly && handleDragStart(link.id)}
                      onDragOver={(e) => !readOnly && handleDragOver(e)}
                      onDrop={() => !readOnly && handleDrop(link.id)}
                      style={{
                        backgroundColor: "rgba(255,255,255,0.7)",
                        borderRadius: "10px",
                        border: "1px solid rgba(148,163,184,0.25)",
                        cursor: readOnly ? "default" : "grab",
                        fontSize: "12px",
                        opacity: draggedId === link.id ? 0.4 : 1,
                        overflow: "hidden",
                        transition: "background-color 0.15s ease, box-shadow 0.15s ease",
                      }}
                      onMouseOver={(e) => {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(255,255,255,0.92)";
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(15,23,42,0.08)";
                      }}
                      onMouseOut={(e) => {
                        (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(255,255,255,0.7)";
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                      }}
                    >
                      {link.imageUrl && isUrlSafe(link.imageUrl) && (
                        <img
                          src={link.imageUrl}
                          alt=""
                          style={{
                            display: "block",
                            width: "100%",
                            height: 90,
                            objectFit: "cover",
                          }}
                        />
                      )}
                      <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                        {!readOnly && (
                          <GripVertical size={14} strokeWidth={2} style={{ opacity: 0.3, flexShrink: 0 }} />
                        )}
                        {!link.imageUrl && (
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 8,
                              background: `linear-gradient(135deg, ${config.linkColor || "#2563eb"}22, ${config.linkColor || "#2563eb"}11)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <ExternalLink size={13} strokeWidth={2.2} style={{ color: config.linkColor || "#2563eb" }} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontWeight: 600,
                              fontSize: 12.5,
                              color: config.textColor || "#0f172a",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "block",
                              textDecoration: "none",
                            }}
                          >
                            {link.title}
                          </a>
                        </div>
                      {!readOnly && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => handleEditLink(link)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              border: "none",
                              background: "transparent",
                              color: "rgba(100,116,139,0.5)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              transition: "color 0.15s, background 0.15s",
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.color = "#3b82f6";
                              e.currentTarget.style.background = "rgba(59,130,246,0.08)";
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.color = "rgba(100,116,139,0.5)";
                              e.currentTarget.style.background = "transparent";
                            }}
                            aria-label="Edit link"
                          >
                            <Pencil size={14} strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => handleDeleteLink(link.id)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              border: "none",
                              background: "transparent",
                              color: "rgba(100,116,139,0.5)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              transition: "color 0.15s, background 0.15s",
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.color = "#ef4444";
                              e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.color = "rgba(100,116,139,0.5)";
                              e.currentTarget.style.background = "transparent";
                            }}
                            aria-label="Delete link"
                          >
                            <Trash2 size={14} strokeWidth={2} />
                          </button>
                        </div>
                      )}
                      </div>{/* end row */}
                    </div>
                  ))}
                </div>

                {/* Add Link */}
                {!readOnly && (
                  <div
                    style={{
                      borderTop: config.links.length > 0 ? "1px solid rgba(148,163,184,0.18)" : "none",
                      paddingTop: config.links.length > 0 ? 12 : 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Add Link
                    </div>
                    <input
                      type="text"
                      value={linkTitle}
                      onChange={(e) => setLinkTitle(e.target.value)}
                      placeholder="Title"
                      onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        border: "1px solid rgba(148,163,184,0.3)",
                        borderRadius: 10,
                        backgroundColor: "rgba(255,255,255,0.85)",
                        color: config.textColor || "#0f172a",
                        fontSize: 13,
                        boxSizing: "border-box",
                        outline: "none",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = config.linkColor || "#2563eb"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(148,163,184,0.3)"; }}
                    />
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="youtube.com"
                      onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        border: "1px solid rgba(148,163,184,0.3)",
                        borderRadius: 10,
                        backgroundColor: "rgba(255,255,255,0.85)",
                        color: config.textColor || "#0f172a",
                        fontSize: 13,
                        boxSizing: "border-box",
                        outline: "none",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = config.linkColor || "#2563eb"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(148,163,184,0.3)"; }}
                    />
                    {/* Image upload */}
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                        e.target.value = "";
                      }}
                    />
                    {linkImageUrl ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 10, backgroundColor: "rgba(255,255,255,0.85)" }}>
                        <img src={linkImageUrl} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, color: "rgba(100,116,139,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Image attached</span>
                        <button
                          type="button"
                          onClick={() => setLinkImageUrl("")}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(100,116,139,0.6)", fontSize: 11, padding: "2px 6px", borderRadius: 6, flexShrink: 0 }}
                        >Remove</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        disabled={isUploadingImage}
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          border: "1px dashed rgba(148,163,184,0.5)",
                          borderRadius: 10,
                          backgroundColor: "rgba(255,255,255,0.5)",
                          color: "rgba(100,116,139,0.7)",
                          fontSize: 12.5,
                          cursor: isUploadingImage ? "default" : "pointer",
                          textAlign: "left",
                        }}
                      >
                        {isUploadingImage ? "Uploading…" : "+ Upload image (optional)"}
                      </button>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={handleAddLink}
                        disabled={!linkTitle.trim() || !linkUrl.trim()}
                        style={{
                          flex: 1,
                          padding: "9px 0",
                          borderRadius: 10,
                          background: linkTitle.trim() && linkUrl.trim()
                            ? `linear-gradient(180deg, ${config.linkColor || "#2563eb"}, ${config.linkColor || "#2563eb"}dd)`
                            : "rgba(148,163,184,0.2)",
                          color: linkTitle.trim() && linkUrl.trim() ? "white" : "rgba(100,116,139,0.5)",
                          border: "none",
                          cursor: linkTitle.trim() && linkUrl.trim() ? "pointer" : "default",
                          fontSize: 12.5,
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          transition: "filter 0.15s",
                        }}
                        onMouseOver={(e) => { if (linkTitle.trim() && linkUrl.trim()) e.currentTarget.style.filter = "brightness(1.08)"; }}
                        onMouseOut={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
                        aria-label={editingLinkId ? "Update link" : "Add link"}
                      >
                        <Plus size={15} strokeWidth={2.5} />
                        {editingLinkId ? "Update" : "Add Link"}
                      </button>
                      {editingLinkId && (
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            padding: "9px 16px",
                            borderRadius: 10,
                            backgroundColor: "rgba(255,255,255,0.85)",
                            border: "1px solid rgba(148,163,184,0.3)",
                            color: config.textColor || "#0f172a",
                            cursor: "pointer",
                            fontSize: 12.5,
                            fontWeight: 600,
                            transition: "all 0.15s",
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.95)";
                            e.currentTarget.style.borderColor = "rgba(148,163,184,0.5)";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.85)";
                            e.currentTarget.style.borderColor = "rgba(148,163,184,0.3)";
                          }}
                          aria-label="Cancel editing"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : activeTab === "settings" ? (
              // Settings Tab
              <>
                {!readOnly && (
                  <>
                    {/* Colors Section */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Colors
                      </div>

                      {/* Text Color */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 10,
                          backgroundColor: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(148,163,184,0.2)",
                        }}
                      >
                        <Type size={14} strokeWidth={2} style={{ opacity: 0.45, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>Text</span>
                        <span style={{ fontSize: 11, opacity: 0.4, fontFamily: "monospace" }}>{config.textColor || "#333333"}</span>
                        <input
                          type="color"
                          value={config.textColor || "#333333"}
                          onChange={(e) => handleColorChange("textColor", e.target.value)}
                          style={{
                            width: 28,
                            height: 28,
                            border: "2px solid rgba(148,163,184,0.3)",
                            borderRadius: 8,
                            cursor: "pointer",
                            padding: 0,
                            background: "none",
                          }}
                        />
                      </div>

                      {/* Link Color */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 10,
                          backgroundColor: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(148,163,184,0.2)",
                        }}
                      >
                        <Link2 size={14} strokeWidth={2} style={{ opacity: 0.45, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500 }}>Links</span>
                        <span style={{ fontSize: 11, opacity: 0.4, fontFamily: "monospace" }}>{config.linkColor || "#0066cc"}</span>
                        <input
                          type="color"
                          value={config.linkColor || "#0066cc"}
                          onChange={(e) => handleColorChange("linkColor", e.target.value)}
                          style={{
                            width: 28,
                            height: 28,
                            border: "2px solid rgba(148,163,184,0.3)",
                            borderRadius: 8,
                            cursor: "pointer",
                            padding: 0,
                            background: "none",
                          }}
                        />
                      </div>
                    </div>

                    {/* Font Section */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Font
                      </div>
                      <div style={{
                        position: "relative",
                        borderRadius: 10,
                        border: "1px solid rgba(148,163,184,0.35)",
                        backgroundColor: "rgba(255,255,255,0.82)",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
                      }}>
                        <select
                          value={selectedFont}
                          onChange={(e) => onConfigChange?.({ ...config, font: e.target.value as SidePageFont })}
                          style={{
                            width: "100%",
                            appearance: "none",
                            WebkitAppearance: "none",
                            MozAppearance: "none",
                            padding: "10px 34px 10px 12px",
                            border: "none",
                            borderRadius: 10,
                            outline: "none",
                            cursor: "pointer",
                            background: "transparent",
                            fontSize: 13,
                            fontWeight: 600,
                            color: config.textColor || "#0f172a",
                            fontFamily: getSidePageFontFamily(selectedFont),
                          }}
                        >
                          {FONT_OPTIONS.map((opt) => (
                            <option
                              key={opt.value}
                              value={opt.value}
                              style={{ fontFamily: getSidePageFontFamily(opt.value) }}
                            >
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <ChevronRight
                          size={16}
                          strokeWidth={2.2}
                          style={{
                            position: "absolute",
                            right: 10,
                            top: "50%",
                            transform: "translateY(-50%) rotate(90deg)",
                            opacity: 0.5,
                            pointerEvents: "none",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.5, paddingLeft: 2 }}>
                        Includes Google fonts Tiny5 and Bytesized.
                      </div>
                    </div>

                    {/* Header Text Styling */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Header Style
                      </div>

                      {/* Header Preview */}
                      <div
                        style={{
                          padding: "12px",
                          borderRadius: 10,
                          backgroundColor: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(148,163,184,0.2)",
                          textAlign: (config.headerAlign || "left") as any,
                          fontWeight: config.headerBold ? 700 : 400,
                          fontStyle: config.headerItalic ? "italic" : "normal",
                          fontSize: 14,
                          color: config.textColor || "#0f172a",
                        }}
                      >
                        {config.headerText || "Header Preview"}
                      </div>

                      {/* Text Style Toggles */}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => onConfigChange?.({ ...config, headerBold: !config.headerBold })}
                          title="Toggle bold"
                          style={{
                            flex: 1,
                            height: 32,
                            borderRadius: 8,
                            border: config.headerBold ? `2px solid ${config.linkColor || "#2563eb"}` : "1px solid rgba(148,163,184,0.3)",
                            backgroundColor: config.headerBold ? `${config.linkColor || "#2563eb"}15` : "rgba(255,255,255,0.6)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: config.headerBold ? (config.linkColor || "#2563eb") : "rgba(100,116,139,0.6)",
                            transition: "all 0.15s ease",
                          }}
                          onMouseOver={(e) => {
                            if (!config.headerBold) e.currentTarget.style.borderColor = "rgba(148,163,184,0.5)";
                          }}
                          onMouseOut={(e) => {
                            if (!config.headerBold) e.currentTarget.style.borderColor = "rgba(148,163,184,0.3)";
                          }}
                        >
                          <Bold size={14} strokeWidth={2.2} />
                        </button>
                        <button
                          onClick={() => onConfigChange?.({ ...config, headerItalic: !config.headerItalic })}
                          title="Toggle italic"
                          style={{
                            flex: 1,
                            height: 32,
                            borderRadius: 8,
                            border: config.headerItalic ? `2px solid ${config.linkColor || "#2563eb"}` : "1px solid rgba(148,163,184,0.3)",
                            backgroundColor: config.headerItalic ? `${config.linkColor || "#2563eb"}15` : "rgba(255,255,255,0.6)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: config.headerItalic ? (config.linkColor || "#2563eb") : "rgba(100,116,139,0.6)",
                            transition: "all 0.15s ease",
                          }}
                          onMouseOver={(e) => {
                            if (!config.headerItalic) e.currentTarget.style.borderColor = "rgba(148,163,184,0.5)";
                          }}
                          onMouseOut={(e) => {
                            if (!config.headerItalic) e.currentTarget.style.borderColor = "rgba(148,163,184,0.3)";
                          }}
                        >
                          <Italic size={14} strokeWidth={2.2} />
                        </button>
                      </div>

                      {/* Alignment Buttons */}
                      <div style={{ display: "flex", gap: 6 }}>
                        {["left", "center", "right"].map((align) => (
                          <button
                            key={align}
                            onClick={() => onConfigChange?.({ ...config, headerAlign: align as any })}
                            title={`Align ${align}`}
                            style={{
                              flex: 1,
                              height: 32,
                              borderRadius: 8,
                              border: config.headerAlign === align ? `2px solid ${config.linkColor || "#2563eb"}` : "1px solid rgba(148,163,184,0.3)",
                              backgroundColor: config.headerAlign === align ? `${config.linkColor || "#2563eb"}15` : "rgba(255,255,255,0.6)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: config.headerAlign === align ? (config.linkColor || "#2563eb") : "rgba(100,116,139,0.6)",
                              transition: "all 0.15s ease",
                            }}
                            onMouseOver={(e) => {
                              if (config.headerAlign !== align) e.currentTarget.style.borderColor = "rgba(148,163,184,0.5)";
                            }}
                            onMouseOut={(e) => {
                              if (config.headerAlign !== align) e.currentTarget.style.borderColor = "rgba(148,163,184,0.3)";
                            }}
                          >
                            {align === "left" && <AlignLeft size={14} strokeWidth={2.2} />}
                            {align === "center" && <AlignCenter size={14} strokeWidth={2.2} />}
                            {align === "right" && <AlignRight size={14} strokeWidth={2.2} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Behavior Section */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Behavior
                      </div>

                      {/* Toggle: Show by Default */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 10px",
                          borderRadius: 10,
                          backgroundColor: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(148,163,184,0.2)",
                        }}
                      >
                        <Eye size={14} strokeWidth={2} style={{ opacity: 0.45, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500 }}>Show by default</div>
                          <div style={{ fontSize: 10.5, opacity: 0.45, marginTop: 1 }}>Panel opens automatically for visitors</div>
                        </div>
                        {/* Toggle Switch */}
                        <div
                          onClick={() => onConfigChange?.({ ...config, showByDefault: !config.showByDefault })}
                          style={{
                            width: 38,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: config.showByDefault ? (config.linkColor || "#2563eb") : "rgba(148,163,184,0.35)",
                            cursor: "pointer",
                            position: "relative",
                            transition: "background-color 0.2s ease",
                            flexShrink: 0,
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 2,
                              left: config.showByDefault ? 18 : 2,
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              backgroundColor: "white",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                              transition: "left 0.2s ease",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {readOnly && (
                  <div style={{ textAlign: "center", padding: "24px 12px", opacity: 0.4, fontSize: 12 }}>
                    <Settings2 size={20} strokeWidth={1.5} style={{ marginBottom: 6, opacity: 0.5 }} />
                    <div>Settings are configured in the editor.</div>
                  </div>
                )}
              </>
            ) : (
              // Theme Tab
              <>
                {allThemes.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 12px", opacity: 0.45, fontSize: 12, lineHeight: 1.6 }}>
                    <Paintbrush size={24} strokeWidth={1.5} style={{ marginBottom: 6, opacity: 0.5 }} />
                    <div>No themes available</div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>Create themes in the theme editor</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {allThemes.map((t) => {
                      const isActive = theme?.id === t.id;
                      const isLocked = useEditorStore.getState().userTier === "FREE" && t.freeTierOk === false;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleSelectTheme(t.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: isActive
                              ? `2px solid ${config.linkColor || "#2563eb"}`
                              : "1px solid rgba(148,163,184,0.25)",
                            backgroundColor: isActive
                              ? `${config.linkColor || "#2563eb"}12`
                              : isLocked ? "rgba(200,200,200,0.4)" : "rgba(255,255,255,0.7)",
                            cursor: isLocked ? "not-allowed" : "pointer",
                            textAlign: "left",
                            transition: "all 0.15s ease",
                            opacity: isLocked ? 0.55 : 1,
                          }}
                          onMouseOver={(e) => {
                            if (!isActive) {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.92)";
                              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 8px rgba(15,23,42,0.08)";
                            }
                          }}
                          onMouseOut={(e) => {
                            if (!isActive) {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.7)";
                              (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                            }
                          }}
                        >
                          {t.icon && typeof t.icon !== "string" ? (
                            <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
                              <ButtonSpriteIcon
                                icon={t.icon}
                                size={36}
                                fallback={<Paintbrush size={16} strokeWidth={2} style={{ color: config.linkColor || "#2563eb", opacity: 0.5 }} />}
                              />
                            </div>
                          ) : t.icon ? (
                            <img
                              src={t.icon}
                              alt=""
                              style={{
                                width: 36,
                                height: 36,
                                objectFit: "cover",
                                borderRadius: 8,
                                flexShrink: 0,
                                imageRendering: "pixelated",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                background: `linear-gradient(135deg, ${config.linkColor || "#2563eb"}22, ${config.linkColor || "#2563eb"}11)`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              <Paintbrush size={16} strokeWidth={2} style={{ color: config.linkColor || "#2563eb", opacity: 0.5 }} />
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600,
                              fontSize: 12.5,
                              color: config.textColor || "#0f172a",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}>
                              {t.name}
                            </div>
                            {isActive && (
                              <div style={{ fontSize: 10.5, color: config.linkColor || "#2563eb", fontWeight: 600, marginTop: 1 }}>
                                Active
                              </div>
                            )}
                            {isLocked && !isActive && (
                              <div style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 500, marginTop: 1 }}>
                                Upgrade to unlock
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
    </div>
  );
};
