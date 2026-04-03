"use client";

import React, { useRef, useEffect, useState } from "react";
import { useEditorStore } from "../store";
import type {
  WorldObject, ModalPayload, LinkPayload, MediaPayload,
  CustomObjectPayload, ObjectDef,
  ObjectBillboardAction, ObjectClickAction, ObjectHoverAction, PageContent,
} from "@mypixelpage/shared";
import { TILESET_TILE_SIZE } from "@mypixelpage/shared";
import { Trash2, HandMetal } from "lucide-react";
import { T } from "./theme";
import { PageEditorModal } from "./PageEditor";
import { uploadMediaFile } from "../utils/uploadMedia";

/* ─── shared style helpers ─── */
const labelStyle: React.CSSProperties = {
  fontSize: "0.85em", fontWeight: 400, color: T.textDim, marginBottom: 4, display: "block",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 10px", fontSize: 13,
  backgroundColor: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 4,
  color: T.textLight, outline: "none", boxSizing: "border-box",
};
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: "vertical", minHeight: 60 };
const actionBtn: React.CSSProperties = {
  width: "100%", padding: 10, marginTop: 10, border: "none", borderRadius: 4,
  cursor: "pointer", fontSize: "0.95em", fontWeight: 700, transition: "background-color 0.2s",
  color: T.white,
};

const HOVER_SCALE_RANGE_CSS = `
.hover-scale-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 22px;
  background: transparent;
  cursor: pointer;
}
.hover-scale-range::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(56,189,248,0.22) 0%, rgba(59,130,246,0.38) 100%);
  border: 1px solid rgba(59,130,246,0.32);
}
.hover-scale-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid #ffffff;
  margin-top: -6px;
  background: #3b82f6;
  box-shadow: 0 4px 12px rgba(59,130,246,0.45);
}
.hover-scale-range::-moz-range-track {
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(56,189,248,0.22) 0%, rgba(59,130,246,0.38) 100%);
  border: 1px solid rgba(59,130,246,0.32);
}
.hover-scale-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid #ffffff;
  background: #3b82f6;
  box-shadow: 0 4px 12px rgba(59,130,246,0.45);
}
`;

function loadObjectDef(id: string, worldAssets?: { objects?: ObjectDef[] }): ObjectDef | null {
  // Check bundled world assets first (editor has these from the store)
  if (worldAssets?.objects) {
    const bundled = worldAssets.objects.find((obj) => obj.id === id);
    if (bundled) return bundled;
  }
  // Fallback to localStorage (dev environment)
  if (typeof window === "undefined") return null;
  try {
    const defs = JSON.parse(localStorage.getItem("dev-objects") ?? "[]") as ObjectDef[];
    return defs.find((obj) => obj.id === id) ?? null;
  } catch {
    return null;
  }
}

/* ─── Payload sub-editors ─── */
function ModalPayloadEditor({ payload, onChange }: { payload: ModalPayload; onChange: (p: ModalPayload) => void }) {
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Title</span>
        <input style={inputStyle} value={payload.title} onChange={(e) => onChange({ ...payload, title: e.target.value })} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Body</span>
        <textarea style={textareaStyle} value={payload.body} onChange={(e) => onChange({ ...payload, body: e.target.value })} rows={4} />
      </div>
    </>
  );
}

function LinkPayloadEditor({ payload, onChange }: { payload: LinkPayload; onChange: (p: LinkPayload) => void }) {
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>URL</span>
        <input style={inputStyle} value={payload.url} onChange={(e) => onChange({ ...payload, url: e.target.value })} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <input
          type="checkbox" checked={payload.openInNew}
          onChange={(e) => onChange({ ...payload, openInNew: e.target.checked })}
          style={{ accentColor: T.blue, width: 16, height: 16 }}
        />
        <span style={{ ...labelStyle, margin: 0 }}>Open in new tab</span>
      </div>
    </>
  );
}

function MediaPayloadEditor({ payload, onChange }: { payload: MediaPayload; onChange: (p: MediaPayload) => void }) {
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Source URL</span>
        <input style={inputStyle} value={payload.src} onChange={(e) => onChange({ ...payload, src: e.target.value })} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Alt text</span>
        <input style={inputStyle} value={payload.alt} onChange={(e) => onChange({ ...payload, alt: e.target.value })} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Media type</span>
        <select
          value={payload.mediaType}
          onChange={(e) => onChange({ ...payload, mediaType: e.target.value as "image" | "video" })}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
      </div>
    </>
  );
}

/* ─── Mini object preview (renders a source rect from tileset) ─── */
function MiniPreview({ tilesetSrc, srcX, srcY, widthTiles, heightTiles, size = 40, horizontalFlip = false }: {
  tilesetSrc: string; srcX: number; srcY: number; widthTiles: number; heightTiles: number; size?: number; horizontalFlip?: boolean;
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
      if (aspect > 1) dh = size / aspect; else dw = size * aspect;
      ctx.save();
      if (horizontalFlip) {
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, srcX, srcY, sw, sh, (size - dw) / 2, (size - dh) / 2, dw, dh);
      ctx.restore();
    };
    img.src = tilesetSrc;
  }, [tilesetSrc, srcX, srcY, widthTiles, heightTiles, size, !!horizontalFlip]);
  return <canvas ref={ref} width={size} height={size} style={{ borderRadius: 4, imageRendering: "pixelated", border: `1px solid ${T.border}`, background: "#0a0a0a" }} />;
}

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer", appearance: "auto" };

/* ─── Interactable State Editor ─── */
function InteractableEditor({ obj }: { obj: WorldObject }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  const worldAssets = useEditorStore((s) => s.worldData.assets);
  const [pageEditorOpen, setPageEditorOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const hoverImageInputRef = useRef<HTMLInputElement | null>(null);
  const hoverVideoInputRef = useRef<HTMLInputElement | null>(null);
  const billboardImageInputRef = useRef<HTMLInputElement | null>(null);
  const billboardVideoInputRef = useRef<HTMLInputElement | null>(null);
  const payload = obj.payload as CustomObjectPayload;

  // Interactable is defined on the ObjectDef (admin-level), not toggled per-instance
  const def = loadObjectDef(payload.objectDefId, worldAssets);
  const isInteractable = def?.interactable ?? payload.interactable ?? false;

  const onClickAction = payload.onClick ?? { type: "none" as const };
  const onHoverAction = payload.onHover ?? { type: "none" as const };
  const billboardAction = payload.billboard ?? { type: "none" as const };
  const billboardEnabled = billboardAction.type !== "none";
  const billboardClosable = payload.billboardClosable ?? false;
  const billboardOpen = payload.billboardOpen ?? true;
  const billboardPreview = payload.billboardPreview ?? true;
  const billboardMediaScale = payload.billboardMediaScale ?? 1;
  const hoverAnchor = payload.hoverAnchor ?? { x: 0.5, y: 0 };
  const billboardAnchor = payload.billboardAnchor ?? { x: 0.5, y: 0 };
  const hoverPreview = payload.hoverPreview ?? false;
  const hoverMediaScale = payload.hoverMediaScale ?? 1;

  const updatePayload = (patch: Partial<CustomObjectPayload>) => {
    updateObject(obj.id, { payload: { ...payload, ...patch } });
  };

  const setBillboardAction = (next: ObjectBillboardAction) => {
    if (next.type === "none") {
      updatePayload({ billboard: next });
      return;
    }
    // Billboard mode is exclusive: clear click/hover interactions when enabled.
    updatePayload({
      billboard: next,
      onClick: { type: "none" },
      onHover: { type: "none" },
    });
  };

  const handleHoverUpload = async (file: File, mediaType: "image" | "video") => {
    setUploadStatus(mediaType === "image" ? "Uploading image…" : "Uploading video…");
    try {
      const uploaded = await uploadMediaFile(file);
      if (mediaType === "image") {
        updatePayload({ onHover: { type: "showImage", imageUrl: uploaded.url } });
      } else {
        updatePayload({ onHover: { type: "showVideo", videoUrl: uploaded.url } });
      }
      setUploadStatus(`Uploaded ${uploaded.filename}`);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed");
    }
  };

  const handleBillboardUpload = async (file: File, mediaType: "image" | "video") => {
    setUploadStatus(mediaType === "image" ? "Uploading billboard image…" : "Uploading billboard video…");
    try {
      const uploaded = await uploadMediaFile(file);
      if (mediaType === "image") {
        setBillboardAction({ type: "showImage", imageUrl: uploaded.url });
      } else {
        setBillboardAction({ type: "showVideo", videoUrl: uploaded.url });
      }
      setUploadStatus(`Uploaded ${uploaded.filename}`);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed");
    }
  };

  if (!isInteractable) return null;

  return (
    <div style={{ marginBottom: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
      <style>{HOVER_SCALE_RANGE_CSS}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#22c55e", background: "rgba(34,197,94,0.12)", padding: "2px 6px", borderRadius: 4 }}>Interactable</span>
      </div>
          {/* Billboard State */}
          <div style={{ marginBottom: 12, padding: "8px 10px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 6, border: `1px solid ${T.border}` }}>
            <span style={{ ...labelStyle, fontWeight: 600, fontSize: "0.8em", textTransform: "uppercase", letterSpacing: 0.5, color: "#f43f5e" }}>Billboard (Always On)</span>
            <select
              value={billboardAction.type}
              onChange={(e) => {
                const type = e.target.value;
                if (type === "none") {
                  setBillboardAction({ type: "none" });
                } else if (type === "showImage") {
                  setBillboardAction({
                    type: "showImage",
                    imageUrl: (billboardAction as { imageUrl?: string }).imageUrl ?? "",
                  });
                } else if (type === "showVideo") {
                  setBillboardAction({
                    type: "showVideo",
                    videoUrl: (billboardAction as { videoUrl?: string }).videoUrl ?? "",
                  });
                } else if (type === "showText") {
                  setBillboardAction({
                    type: "showText",
                    text: (billboardAction as { text?: string }).text ?? "",
                  });
                }
              }}
              style={selectStyle}
            >
              <option value="none">None</option>
              <option value="showImage">Show Image / GIF</option>
              <option value="showVideo">Show Video</option>
              <option value="showText">Show Text</option>
            </select>

            {billboardAction.type === "showImage" && (
              <div style={{ marginTop: 8 }}>
                <span style={labelStyle}>Image / GIF URL</span>
                <input
                  style={inputStyle}
                  value={billboardAction.imageUrl}
                  placeholder="https://..."
                  onChange={(e) => setBillboardAction({ type: "showImage", imageUrl: e.target.value })}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => billboardImageInputRef.current?.click()}
                    style={{ ...actionBtn, marginTop: 0, width: "auto", padding: "8px 12px", backgroundColor: T.blue, fontSize: "0.8em" }}
                  >
                    Upload Image / GIF
                  </button>
                  {uploadStatus && <span style={{ fontSize: 11, color: T.textMuted }}>{uploadStatus}</span>}
                </div>
                <input
                  ref={billboardImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) await handleBillboardUpload(file, "image");
                  }}
                />
              </div>
            )}

            {billboardAction.type === "showVideo" && (
              <div style={{ marginTop: 8 }}>
                <span style={labelStyle}>Video URL</span>
                <input
                  style={inputStyle}
                  value={billboardAction.videoUrl}
                  placeholder="https://..."
                  onChange={(e) => setBillboardAction({ type: "showVideo", videoUrl: e.target.value })}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => billboardVideoInputRef.current?.click()}
                    style={{ ...actionBtn, marginTop: 0, width: "auto", padding: "8px 12px", backgroundColor: T.blue, fontSize: "0.8em" }}
                  >
                    Upload Video
                  </button>
                  {uploadStatus && <span style={{ fontSize: 11, color: T.textMuted }}>{uploadStatus}</span>}
                </div>
                <input
                  ref={billboardVideoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) await handleBillboardUpload(file, "video");
                  }}
                />
              </div>
            )}

            {billboardAction.type === "showText" && (
              <div style={{ marginTop: 8 }}>
                <span style={labelStyle}>Billboard Text</span>
                <textarea
                  style={textareaStyle}
                  value={billboardAction.text}
                  placeholder="Always-on text..."
                  rows={2}
                  onChange={(e) => setBillboardAction({ type: "showText", text: e.target.value })}
                />
              </div>
            )}

            {billboardAction.type !== "none" && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={billboardPreview}
                    onChange={(e) => updatePayload({ billboardPreview: e.target.checked })}
                    style={{ accentColor: T.blue, width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 12, color: T.textLight, fontWeight: 600 }}>Show billboard preview on world canvas</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={billboardClosable}
                    onChange={(e) => updatePayload({ billboardClosable: e.target.checked || undefined })}
                    style={{ accentColor: T.blue, width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 12, color: T.textLight, fontWeight: 600 }}>Clickable to toggle open/close</span>
                </label>

                {billboardClosable && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={billboardOpen}
                      onChange={(e) => updatePayload({ billboardOpen: e.target.checked })}
                      style={{ accentColor: T.blue, width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: 12, color: T.textLight }}>Start open</span>
                  </label>
                )}

                {(billboardAction.type === "showImage" || billboardAction.type === "showVideo") && (
                  <div>
                    <span style={{ ...labelStyle, marginBottom: 6 }}>Media Size ({billboardMediaScale.toFixed(2)}x)</span>
                    <input
                      className="hover-scale-range"
                      type="range"
                      min="0.25"
                      max="4"
                      step="0.05"
                      value={billboardMediaScale}
                      onChange={(e) => updatePayload({ billboardMediaScale: parseFloat(e.target.value) })}
                      style={{ width: "100%" }}
                    />
                  </div>
                )}
              </div>
            )}

            {billboardEnabled && (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "#fca5a5" }}>
                Billboard mode is active. On Click and On Hover are disabled.
              </p>
            )}
          </div>

          {/* On Click State */}
          <div style={{ marginBottom: 12, padding: "8px 10px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 6, border: `1px solid ${T.border}`, opacity: billboardEnabled ? 0.55 : 1 }}>
            <span style={{ ...labelStyle, fontWeight: 600, fontSize: "0.8em", textTransform: "uppercase", letterSpacing: 0.5, color: T.blue }}>On Click</span>
            <select
              value={onClickAction.type}
              disabled={billboardEnabled}
              onChange={(e) => {
                const type = e.target.value;
                if (type === "none") {
                  updatePayload({ onClick: { type: "none" } });
                } else if (type === "openPageEditor") {
                  updatePayload({
                    onClick: {
                      type: "openPageEditor",
                      pageContent: (onClickAction as { pageContent?: PageContent }).pageContent ?? { tiptapDoc: { type: "doc", content: [{ type: "paragraph" }] } },
                    },
                  });
                }
              }}
              style={selectStyle}
            >
              <option value="none">None</option>
              <option value="openPageEditor">Open Page Editor</option>
            </select>

            {onClickAction.type === "openPageEditor" && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => setPageEditorOpen(true)}
                  style={{
                    ...actionBtn,
                    marginTop: 0,
                    backgroundColor: T.blue,
                    fontSize: "0.85em",
                    padding: "8px 12px",
                  }}
                >
                  Edit Page Content
                </button>
                <p style={{ margin: "4px 0 0", fontSize: "0.75em", color: T.textMuted }}>
                  Page content ready to edit
                </p>
              </div>
            )}
          </div>

          {/* On Hover State */}
          <div style={{ marginBottom: 12, padding: "8px 10px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 6, border: `1px solid ${T.border}`, opacity: billboardEnabled ? 0.55 : 1 }}>
            <span style={{ ...labelStyle, fontWeight: 600, fontSize: "0.8em", textTransform: "uppercase", letterSpacing: 0.5, color: "#a78bfa" }}>On Hover</span>
            <select
              value={onHoverAction.type}
              disabled={billboardEnabled}
              onChange={(e) => {
                if (billboardEnabled) return;
                const type = e.target.value;
                if (type === "none") {
                  updatePayload({ onHover: { type: "none" } });
                } else if (type === "showImage") {
                  updatePayload({
                    onHover: {
                      type: "showImage",
                      imageUrl: (onHoverAction as { imageUrl?: string }).imageUrl ?? "",
                    },
                  });
                } else if (type === "showVideo") {
                  updatePayload({
                    onHover: {
                      type: "showVideo",
                      videoUrl: (onHoverAction as { videoUrl?: string }).videoUrl ?? "",
                    },
                  });
                } else if (type === "showText") {
                  updatePayload({
                    onHover: {
                      type: "showText",
                      text: (onHoverAction as { text?: string }).text ?? "",
                    },
                  });
                }
              }}
              style={selectStyle}
            >
              <option value="none">None</option>
              <option value="showImage">Show Image / GIF</option>
              <option value="showVideo">Show Video</option>
              <option value="showText">Show Text</option>
            </select>

            {onHoverAction.type === "showImage" && (
              <div style={{ marginTop: 8 }}>
                <span style={labelStyle}>Image / GIF URL</span>
                <input
                  style={inputStyle}
                  value={onHoverAction.imageUrl}
                  placeholder="https://..."
                  onChange={(e) => updatePayload({ onHover: { type: "showImage", imageUrl: e.target.value } })}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => hoverImageInputRef.current?.click()}
                    style={{ ...actionBtn, marginTop: 0, width: "auto", padding: "8px 12px", backgroundColor: T.blue, fontSize: "0.8em" }}
                  >
                    Upload Image / GIF
                  </button>
                  {uploadStatus && <span style={{ fontSize: 11, color: T.textMuted }}>{uploadStatus}</span>}
                </div>
                <input
                  ref={hoverImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) await handleHoverUpload(file, "image");
                  }}
                />
              </div>
            )}

            {onHoverAction.type === "showVideo" && (
              <div style={{ marginTop: 8 }}>
                <span style={labelStyle}>Video URL</span>
                <input
                  style={inputStyle}
                  value={onHoverAction.videoUrl}
                  placeholder="https://..."
                  onChange={(e) => updatePayload({ onHover: { type: "showVideo", videoUrl: e.target.value } })}
                />
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => hoverVideoInputRef.current?.click()}
                    style={{ ...actionBtn, marginTop: 0, width: "auto", padding: "8px 12px", backgroundColor: T.blue, fontSize: "0.8em" }}
                  >
                    Upload Video
                  </button>
                  {uploadStatus && <span style={{ fontSize: 11, color: T.textMuted }}>{uploadStatus}</span>}
                </div>
                <input
                  ref={hoverVideoInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) await handleHoverUpload(file, "video");
                  }}
                />
              </div>
            )}

            {onHoverAction.type === "showText" && (
              <div style={{ marginTop: 8 }}>
                <span style={labelStyle}>Hover Text</span>
                <textarea
                  style={textareaStyle}
                  value={onHoverAction.text}
                  placeholder="Text to show on hover..."
                  rows={2}
                  onChange={(e) => updatePayload({ onHover: { type: "showText", text: e.target.value } })}
                />
              </div>
            )}

            {(onHoverAction.type === "showImage" || onHoverAction.type === "showVideo") && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={hoverPreview}
                    onChange={(e) => updatePayload({ hoverPreview: e.target.checked || undefined })}
                    style={{ accentColor: T.blue, width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 12, color: T.textLight, fontWeight: 600 }}>Show preview on world canvas</span>
                </label>

                <div>
                  <span style={{ ...labelStyle, marginBottom: 6 }}>Media Size ({hoverMediaScale.toFixed(2)}x)</span>
                  <input
                    className="hover-scale-range"
                    type="range"
                    min="0.25"
                    max="4"
                    step="0.05"
                    value={hoverMediaScale}
                    onChange={(e) => updatePayload({ hoverMediaScale: parseFloat(e.target.value) })}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>
            )}

          </div>

          {/* Overlay Placement (tile-style anchor presets) */}
          {(billboardAction.type !== "none" || onHoverAction.type !== "none") && (
            <div style={{ marginBottom: 12, padding: "8px 10px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 6, border: `1px solid ${T.border}` }}>
              <span style={{ ...labelStyle, fontWeight: 600, fontSize: "0.8em", textTransform: "uppercase", letterSpacing: 0.5, color: "#f59e0b" }}>Overlay Placement</span>
              <p style={{ margin: "0 0 6px", fontSize: "0.75em", color: T.textMuted }}>
                Pick an anchor tile inside the object sprite.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {[0, 0.5, 1].flatMap((y) => [0, 0.5, 1].map((x) => ({ x, y }))).map((pt) => {
                  const activeAnchor = billboardAction.type !== "none" ? billboardAnchor : hoverAnchor;
                  const active = Math.abs(activeAnchor.x - pt.x) < 0.01 && Math.abs(activeAnchor.y - pt.y) < 0.01;
                  return (
                    <button
                      key={`${pt.x}-${pt.y}`}
                      type="button"
                      onClick={() => updatePayload(billboardAction.type !== "none" ? { billboardAnchor: { x: pt.x, y: pt.y } } : { hoverAnchor: { x: pt.x, y: pt.y } })}
                      title={`X ${Math.round(pt.x * 100)}%, Y ${Math.round(pt.y * 100)}%`}
                      style={{
                        height: 32,
                        borderRadius: 8,
                        border: active ? "2px solid #f59e0b" : `1px solid ${T.border}`,
                        background: active ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.04)",
                        cursor: "pointer",
                        position: "relative",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: active ? "#f59e0b" : "#9ca3af",
                      }} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

      {/* Page editor modal */}
      {pageEditorOpen && onClickAction.type === "openPageEditor" && (
        <PageEditorModal
          pageContent={onClickAction.pageContent}
          onSave={(content: PageContent) => {
            updatePayload({ onClick: { type: "openPageEditor", pageContent: content } });
            setPageEditorOpen(false);
          }}
          onClose={() => setPageEditorOpen(false)}
        />
      )}
    </div>
  );
}

/* ─── Object form ─── */
function ObjectForm({ obj }: { obj: WorldObject }) {
  const updateObject = useEditorStore((s) => s.updateObject);
  const removeObject = useEditorStore((s) => s.removeObject);
  const worldAssets = useEditorStore((s) => s.worldData.assets);
  const customDef = obj.payload.kind === "custom" ? loadObjectDef((obj.payload as CustomObjectPayload).objectDefId, worldAssets) : null;

  const onPayloadChange = (p: ModalPayload | LinkPayload | MediaPayload) => updateObject(obj.id, { payload: p });

  return (
    <div>
      {/* Preview area */}
      <div style={{
        backgroundColor: T.inputBg, border: `1px solid ${T.border}`, padding: 10,
        marginBottom: 16, display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: 60, borderRadius: 4,
      }}>
        {customDef ? (
          <div style={{ textAlign: "center" }}>
            <MiniPreview
              tilesetSrc={customDef.tilesetSrc}
              srcX={customDef.srcX}
              srcY={customDef.srcY}
              widthTiles={customDef.widthTiles}
              heightTiles={customDef.heightTiles}
              size={52}
            />
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
              ({obj.gridX}, {obj.gridY})
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 24 }}>{obj.type === "modal" ? "💬" : obj.type === "link" ? "🔗" : obj.type === "media" ? "🖼️" : "🪵"}</span>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
              ({obj.gridX}, {obj.gridY})
            </div>
          </div>
        )}
      </div>

      {/* Properties */}
      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Label</span>
        <input style={inputStyle} value={obj.label} onChange={(e) => updateObject(obj.id, { label: e.target.value })} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <span style={labelStyle}>Type</span>
        <p style={{ margin: 0, fontSize: "0.85em", color: T.textLight, textTransform: "capitalize" }}>{obj.type}</p>
      </div>

      {customDef && (
        <div style={{ marginBottom: 12 }}>
          <span style={labelStyle}>Object Definition</span>
          <p style={{ margin: 0, fontSize: "0.85em", color: T.textLight }}>{customDef.name}</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.8em", color: T.textMuted }}>
            {customDef.widthTiles}x{customDef.heightTiles} · z{customDef.zLayer}
          </p>
        </div>
      )}

      {/* Variation picker for custom objects */}
      {customDef && customDef.variations && customDef.variations.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <span style={labelStyle}>Variation</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {/* Default (base) variation */}
            <button
              onClick={() => {
                const payload = obj.payload as CustomObjectPayload;
                updateObject(obj.id, { payload: { ...payload, variationIndex: 0 } });
              }}
              title="Default"
              style={{
                padding: 2, border: ((obj.payload as CustomObjectPayload).variationIndex ?? 0) === 0 ? `2px solid ${T.blue}` : `1px solid ${T.border}`,
                borderRadius: 6, background: "none", cursor: "pointer",
              }}
            >
              <MiniPreview tilesetSrc={customDef.tilesetSrc} srcX={customDef.srcX} srcY={customDef.srcY}
                widthTiles={customDef.widthTiles} heightTiles={customDef.heightTiles} horizontalFlip={customDef.horizontalFlip} size={36} />
            </button>
            {/* Additional variations */}
            {customDef.variations.map((v, i) => (
              <button
                key={i}
                onClick={() => {
                  const payload = obj.payload as CustomObjectPayload;
                  updateObject(obj.id, { payload: { ...payload, variationIndex: i + 1 } });
                }}
                title={v.label || `Variation ${i + 1}`}
                style={{
                  padding: 2, border: ((obj.payload as CustomObjectPayload).variationIndex ?? 0) === i + 1 ? `2px solid ${T.blue}` : `1px solid ${T.border}`,
                  borderRadius: 6, background: "none", cursor: "pointer",
                }}
              >
                <MiniPreview tilesetSrc={v.tilesetSrc ?? customDef.tilesetSrc} srcX={v.srcX} srcY={v.srcY}
                  widthTiles={v.widthTiles ?? customDef.widthTiles} heightTiles={v.heightTiles ?? customDef.heightTiles} horizontalFlip={v.horizontalFlip} size={36} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Interactable state editor (custom objects only) */}
      {obj.payload.kind === "custom" && <InteractableEditor obj={obj} />}

      {/* Payload editor */}
      {obj.payload.kind === "modal" && <ModalPayloadEditor payload={obj.payload as ModalPayload} onChange={onPayloadChange} />}
      {obj.payload.kind === "link" && <LinkPayloadEditor payload={obj.payload as LinkPayload} onChange={onPayloadChange} />}
      {obj.payload.kind === "media" && <MediaPayloadEditor payload={obj.payload as MediaPayload} onChange={onPayloadChange} />}

      {/* Actions */}
      <button
        onClick={() => removeObject(obj.id)}
        style={{ ...actionBtn, backgroundColor: T.red }}
      >
        Delete
      </button>
    </div>
  );
}

/* ─── inspector panel ─── */
export function ObjectPropsPanel(props?: { "data-tour-right-props"?: boolean }) {
  const selectedObjectId = useEditorStore((s) => s.selectedObjectId);
  const objects = useEditorStore((s) => s.worldData.objects);
  const obj = objects.find((o) => o.id === selectedObjectId) ?? null;

  return (
    <aside
      data-tour-right-props={props?.["data-tour-right-props"]}
      style={{
        width: 250, backgroundColor: T.sidebarBg, padding: 15,
        boxShadow: "-2px 0 5px rgba(0,0,0,0.2)", overflowY: "auto", flexShrink: 0,
      }}
    >
      <h3 style={{
        margin: "0 0 15px", fontSize: "1.1em", color: T.textLight,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        Inspector
      </h3>

      {obj ? (
        <ObjectForm obj={obj} />
      ) : (
        <div style={{ color: T.textMuted, fontSize: 13, textAlign: "center", padding: "40px 10px" }}>
          <HandMetal size={32} style={{ color: T.textMuted, marginBottom: 10 }} />
          <p style={{ margin: 0 }}>Select an object on the canvas to view its properties.</p>
        </div>
      )}
    </aside>
  );
}
