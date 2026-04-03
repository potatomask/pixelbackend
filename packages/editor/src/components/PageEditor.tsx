"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import TextAlign from "@tiptap/extension-text-align";

import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { Node, mergeAttributes } from "@tiptap/core";
import type { PageContent } from "@mypixelpage/shared";
import { uploadMediaFile } from "../utils/uploadMedia";

/* ─── Page builder palette (detached from game-editor theme) ─── */
const P = {
  bg: "#ffffff",
  bgSoft: "#fafafa",
  bgMuted: "#f4f4f5",
  border: "#e4e4e7",
  borderLight: "#f0f0f2",
  text: "#18181b",
  textSec: "#3f3f46",
  textMuted: "#71717a",
  textDim: "#a1a1aa",
  accent: "#3b82f6",
  accentHover: "#2563eb",
  accentSoft: "rgba(59,130,246,0.08)",
} as const;

/** Returns true when the hex colour is perceptually light. */
function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return true;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

/* ─── Editor CSS (uses CSS custom properties for bg-aware contrast) ─── */
const EDITOR_CSS = `
/* ── ProseMirror canvas ── */
.page-builder .ProseMirror {
  outline: none;
  min-height: 100%;
  max-width: var(--pb-width, 720px);
  margin: 0 auto;
  padding: 52px 40px 120px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.75;
  color: var(--pb-text);
}
/* Editor-only: page-edge guides visible while editing */
.page-builder-editor .ProseMirror {
  border-left: 1px dashed color-mix(in srgb, var(--pb-link) 28%, transparent);
  border-right: 1px dashed color-mix(in srgb, var(--pb-link) 28%, transparent);
}
.page-builder .ProseMirror:focus { outline: none; }
.page-builder .ProseMirror h1 {
  font-size: 2.25em; font-weight: 700; line-height: 1.2;
  margin: 1em 0 .4em; color: var(--pb-heading);
  letter-spacing: -.025em;
}
.page-builder .ProseMirror h2 {
  font-size: 1.65em; font-weight: 600; line-height: 1.3;
  margin: .85em 0 .35em; color: var(--pb-heading);
  letter-spacing: -.018em;
}
.page-builder .ProseMirror h3 {
  font-size: 1.3em; font-weight: 600; line-height: 1.35;
  margin: .75em 0 .3em; color: var(--pb-heading);
}
.page-builder .ProseMirror p { margin: 0 0 .75em; }
.page-builder .ProseMirror ul,
.page-builder .ProseMirror ol { padding-left: 1.5em; margin: 0 0 .75em; }
.page-builder .ProseMirror li { margin-bottom: .2em; }
.page-builder .ProseMirror li p { margin: 0; }
.page-builder .ProseMirror blockquote {
  border-left: 3px solid var(--pb-border);
  padding-left: 16px; margin: 1em 0;
  color: var(--pb-muted); font-style: italic;
}
.page-builder .ProseMirror code {
  background: var(--pb-code-bg); padding: 2px 6px; border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', monospace; font-size: .875em;
}
.page-builder .ProseMirror pre {
  background: #18181b; color: #e4e4e7;
  padding: 16px 20px; border-radius: 8px;
  overflow-x: auto; margin: 1em 0;
  font-size: .875em; line-height: 1.7;
}
.page-builder .ProseMirror pre code {
  background: none; padding: 0; color: inherit; font-size: inherit;
}
.page-builder .ProseMirror hr {
  border: none; border-top: 1px solid var(--pb-border); margin: 2em 0;
}
.page-builder .ProseMirror hr[data-divider="true"] {
  margin: 2.1em 0;
  border: none;
}
.page-builder .ProseMirror hr.pb-divider-solid {
  border-top: 1px solid var(--pb-border);
}
.page-builder .ProseMirror hr.pb-divider-dashed {
  border-top: 1px dashed var(--pb-border);
}
.page-builder .ProseMirror hr.pb-divider-dots {
  height: 8px;
  background-image: radial-gradient(circle, var(--pb-border) 1.2px, transparent 1.2px);
  background-size: 8px 8px;
  background-position: center;
}
.page-builder .ProseMirror hr.pb-divider-glow {
  border-top: 1px solid color-mix(in srgb, var(--pb-link) 75%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--pb-link) 15%, transparent),
              0 0 14px color-mix(in srgb, var(--pb-link) 38%, transparent);
}
.page-builder .ProseMirror hr[data-divider="true"].ProseMirror-selectednode {
  outline: 2px solid color-mix(in srgb, var(--pb-link) 55%, transparent);
  outline-offset: 4px;
}
.page-builder .ProseMirror img {
  max-width: 100%; border-radius: 8px; display: block;
  margin: 1.5em auto;
}
.page-builder .ProseMirror video {
  width: 100%; max-width: 100%; max-height: 420px;
  border-radius: 8px; display: block; margin: 1.5em auto;
  background: rgba(0,0,0,.78);
}
.page-builder .ProseMirror a { color: var(--pb-link); text-decoration: underline; }
.page-builder .ProseMirror a:hover { filter: brightness(1.15); }
.page-builder .ProseMirror iframe {
  max-width: 100%; border-radius: 8px; display: block; margin: 1.5em auto;
}
.page-builder .ProseMirror p.is-editor-empty:first-child::before {
  content: "Type something amazing…";
  float: left; color: var(--pb-muted); pointer-events: none; height: 0;
}

/* Scrollbar blends with page background */
.page-builder::-webkit-scrollbar { width: 6px; }
.page-builder::-webkit-scrollbar-track { background: var(--pb-bg, transparent); }
.page-builder::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--pb-scroll-thumb, #000) 20%, transparent);
  border-radius: 999px;
}
.page-builder::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--pb-scroll-thumb, #000) 38%, transparent);
}

/* two-column row */
.page-builder .ProseMirror .pb-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 1em 0;
  width: 100%;
}
.page-builder .ProseMirror .pb-col {
  min-height: 60px;
  padding: 10px 12px;
}
/* Editor-only: dashed column borders visible while editing */
.page-builder-editor .ProseMirror .pb-col {
  border: 1px dashed var(--pb-border);
  border-radius: 8px;
}

.pb-hover-controls {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  border-radius: 10px;
  border: 1px solid ${P.border};
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  z-index: 10;
}

.pb-danger-btn {
  border: 1px solid #fecaca;
  color: #b91c1c;
  background: #fff1f2;
  border-radius: 8px;
  padding: 4px 7px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.pb-divider-select {
  border: 1px solid ${P.border};
  background: #ffffff;
  color: ${P.textSec};
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
}
/* premium slider */
.pb-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 20px;
  background: transparent;
  cursor: pointer;
}
.pb-range::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, #dbeafe 0%, #bfdbfe 55%, #e4e4e7 100%);
}
.pb-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  margin-top: -6px;
  border: 2px solid #ffffff;
  background: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
}
.pb-range::-moz-range-track {
  height: 6px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(90deg, #dbeafe 0%, #bfdbfe 55%, #e4e4e7 100%);
}
.pb-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.35);
}
/* toolbar hover */
.pb-toolbar button:hover { background: ${P.bgMuted} !important; }
`;

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

type DividerVariant = "solid" | "dashed" | "dots" | "glow";

type HoverTarget = {
  kind: "twoColumn" | "divider" | "image" | "uploadedVideo" | "youtube";
  pos: number;
  top: number;
  right: number;
  variant?: DividerVariant;
};

const DIVIDER_LABELS: Record<DividerVariant, string> = {
  solid: "Solid",
  dashed: "Dashed",
  dots: "Dots",
  glow: "Glow",
};

const ColumnItem = Node.create({
  name: "columnItem",
  group: "block",
  content: "block+",
  parseHTML() { return [{ tag: "div[data-col]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-col": "true", class: "pb-col" }), 0];
  },
});

const TwoColumnLayout = Node.create({
  name: "twoColumnLayout",
  group: "block",
  content: "columnItem{2}",
  parseHTML() { return [{ tag: "div[data-two-col]" }]; },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-two-col": "true", class: "pb-two-col" }), 0];
  },
});

const UploadedVideo = Node.create({
  name: "uploadedVideo",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
    };
  },
  parseHTML() { return [{ tag: 'video[data-uploaded-video="true"]' }]; },
  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        "data-uploaded-video": "true",
        controls: "true",
        muted: "true",
        loop: "true",
        playsinline: "true",
        preload: "metadata",
      }),
    ];
  },
});

const StyledDivider = Node.create({
  name: "styledDivider",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      variant: {
        default: "solid",
        parseHTML: (element) => element.getAttribute("data-variant") ?? "solid",
      },
    };
  },

  parseHTML() {
    return [{ tag: 'hr[data-divider="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const variant = (HTMLAttributes.variant as DividerVariant | undefined) ?? "solid";
    return [
      "hr",
      mergeAttributes(HTMLAttributes, {
        "data-divider": "true",
        "data-variant": variant,
        class: `pb-divider pb-divider-${variant}`,
      }),
    ];
  },
});

/* ─── CSS-variable map computed from bg colour ─── */
function bgVars(bg: string): Record<string, string> {
  const l = isLight(bg);
  return {
    "--pb-text":         l ? "#3f3f46" : "#e4e4e7",
    "--pb-heading":      l ? "#18181b" : "#f4f4f5",
    "--pb-muted":        l ? "#71717a" : "#a1a1aa",
    "--pb-border":       l ? "#e4e4e7" : "rgba(255,255,255,.12)",
    "--pb-code-bg":      l ? "#f4f4f5" : "rgba(255,255,255,.08)",
    "--pb-link":         l ? "#3b82f6" : "#60a5fa",
    "--pb-bg":           bg,
    "--pb-scroll-thumb": l ? "#000" : "#fff",
  };
}

/* ─── Overlay / modal base ─── */
const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999,
  backgroundColor: "rgba(0,0,0,.45)",
  display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(6px)",
};
const modalBase: React.CSSProperties = {
  backgroundColor: P.bg, borderRadius: 14,
  display: "flex", flexDirection: "column", overflow: "hidden",
  boxShadow: "0 24px 48px -12px rgba(0,0,0,.25), 0 0 0 1px rgba(0,0,0,.06)",
};

/* ─── Toolbar primitives ─── */
function TBtn({ active, onClick, title, children, style: ex }: {
  active?: boolean; onClick: () => void;
  title?: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <button onMouseDown={(e) => { e.preventDefault(); onClick(); }} title={title} style={{
      padding: "5px 7px", fontSize: 13, border: "none", borderRadius: 6,
      cursor: "pointer",
      color: active ? P.accent : P.textMuted,
      backgroundColor: active ? P.accentSoft : "transparent",
      fontWeight: active ? 600 : 500,
      minWidth: 28, height: 30,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      transition: "all .12s ease", ...ex,
    }}>{children}</button>
  );
}
function TDiv() {
  return <div style={{ width: 1, height: 18, background: P.border, margin: "0 6px", alignSelf: "center", opacity: .6 }} />;
}

/* ── SVG micro-icons (16×16) ── */
const ico = {
  alignL:  <svg width="16" height="16" fill="none"><path d="M2 3.5h12M2 6.5h8M2 9.5h12M2 12.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  alignC:  <svg width="16" height="16" fill="none"><path d="M2 3.5h12M4 6.5h8M2 9.5h12M5 12.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  alignR:  <svg width="16" height="16" fill="none"><path d="M2 3.5h12M6 6.5h8M2 9.5h12M8 12.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  ul:      <svg width="16" height="16" fill="none"><circle cx="3" cy="4.5" r="1.2" fill="currentColor"/><circle cx="3" cy="8.5" r="1.2" fill="currentColor"/><circle cx="3" cy="12.5" r="1.2" fill="currentColor"/><path d="M6.5 4.5h7M6.5 8.5h7M6.5 12.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  ol:      <svg width="16" height="16" fill="none"><text x="1" y="6" fill="currentColor" fontSize="7" fontWeight="600" fontFamily="system-ui">1</text><text x="1" y="10" fill="currentColor" fontSize="7" fontWeight="600" fontFamily="system-ui">2</text><text x="1" y="14" fill="currentColor" fontSize="7" fontWeight="600" fontFamily="system-ui">3</text><path d="M7 4.5h7M7 8.5h7M7 12.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  quote:   <svg width="16" height="16" fill="none"><path d="M4 5c-1.5 0-2 1-2 2s.5 2 2 2c1 0 1.5-.5 1.5-1.5S5 6.5 4.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M11 5c-1.5 0-2 1-2 2s.5 2 2 2c1 0 1.5-.5 1.5-1.5S12 6.5 11.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  row:     <svg width="16" height="16" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 3v10" stroke="currentColor" strokeWidth="1.5"/></svg>,
  hr:      <svg width="16" height="16" fill="none"><path d="M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"/></svg>,
  link:    <svg width="16" height="16" fill="none"><path d="M6.5 9.5a3 3 0 004.24 0l2-2a3 3 0 10-4.24-4.24l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M9.5 6.5a3 3 0 00-4.24 0l-2 2a3 3 0 104.24 4.24l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  image:   <svg width="16" height="16" fill="none"><rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="5.5" cy="6.5" r="1.2" fill="currentColor"/><path d="M2 11l3-2.5 2.5 2 2-1.5L14 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  video:   <svg width="16" height="16" fill="none"><rect x="2" y="3.5" width="12" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M6.8 6.5v3l3-1.5z" fill="currentColor"/></svg>,
  undo:    <svg width="16" height="16" fill="none"><path d="M4 7h6.5a2.5 2.5 0 010 5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 4.5L4 7l3 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  redo:    <svg width="16" height="16" fill="none"><path d="M12 7H5.5a2.5 2.5 0 000 5H7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 4.5l3 2.5-3 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* ─── Toolbar ─── */
function Toolbar({ editor, onInsertRow, onInsertDivider }: {
  editor: Editor | null;
  onInsertRow: () => void;
  onInsertDivider: (variant: DividerVariant) => void;
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL (empty to remove):", prev ?? "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const addYoutube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("YouTube URL:", "https://www.youtube.com/watch?v=");
    if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
  }, [editor]);

  const addVideo = useCallback(() => {
    videoInputRef.current?.click();
  }, []);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    setUploadStatus("Uploading image…");
    try {
      const uploaded = await uploadMediaFile(file);
      editor.chain().focus().insertContent([
        { type: "image", attrs: { src: uploaded.url, alt: file.name } },
        { type: "paragraph" },
      ]).run();
      setUploadStatus(`Uploaded ${uploaded.filename}`);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed");
    }
  }, [editor]);

  const handleVideoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    setUploadStatus("Uploading video…");
    try {
      const uploaded = await uploadMediaFile(file);
      editor.chain().focus().insertContent([
        { type: "uploadedVideo", attrs: { src: uploaded.url } },
        { type: "paragraph" },
      ]).run();
      setUploadStatus(`Uploaded ${uploaded.filename}`);
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed");
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="pb-toolbar" style={{
      display: "flex", flexWrap: "wrap", gap: 2, padding: "6px 20px",
      borderBottom: `1px solid ${P.border}`, backgroundColor: P.bg,
      flexShrink: 0, alignItems: "center",
    }}>
      <TBtn active={editor.isActive("heading",{level:1})} onClick={() => editor.chain().focus().toggleHeading({level:1}).run()}>H1</TBtn>
      <TBtn active={editor.isActive("heading",{level:2})} onClick={() => editor.chain().focus().toggleHeading({level:2}).run()}>H2</TBtn>
      <TBtn active={editor.isActive("heading",{level:3})} onClick={() => editor.chain().focus().toggleHeading({level:3}).run()}>H3</TBtn>
      <TDiv />
      <TBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} style={{fontWeight:700}}>B</TBtn>
      <TBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} style={{fontStyle:"italic"}}>I</TBtn>
      <TBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} style={{textDecoration:"underline"}}>U</TBtn>
      <TBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} style={{textDecoration:"line-through"}}>S</TBtn>
      <TBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} style={{fontFamily:"monospace",fontSize:11}}>&lt;/&gt;</TBtn>
      <TDiv />
      <TBtn active={editor.isActive({textAlign:"left"})} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Left">{ico.alignL}</TBtn>
      <TBtn active={editor.isActive({textAlign:"center"})} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Center">{ico.alignC}</TBtn>
      <TBtn active={editor.isActive({textAlign:"right"})} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Right">{ico.alignR}</TBtn>
      <TDiv />
      <TBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullets">{ico.ul}</TBtn>
      <TBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered">{ico.ol}</TBtn>
      <TBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote">{ico.quote}</TBtn>
      <TBtn onClick={onInsertRow} title="Two-column row">{ico.row}</TBtn>
      <TBtn onClick={() => onInsertDivider("solid")} title="Divider">{ico.hr}</TBtn>
      <TDiv />
      <TBtn active={editor.isActive("link")} onClick={setLink} title="Link">{ico.link}</TBtn>
      <TBtn onClick={addImage} title="Upload image or GIF">{ico.image}</TBtn>
      <TBtn onClick={addVideo} title="Upload video">{ico.video}</TBtn>
      <TBtn onClick={addYoutube} title="YouTube">YT</TBtn>
      <TDiv />
      <label style={{ display:"inline-flex", alignItems:"center", gap:3, cursor:"pointer", padding:"4px 6px", borderRadius:6 }} title="Text color">
        <span style={{ fontSize:13, fontWeight:600, color:(editor.getAttributes("textStyle").color as string)||P.text }}>A</span>
        <input type="color"
          value={(editor.getAttributes("textStyle").color as string|undefined) ?? "#18181b"}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          style={{ width:14, height:14, border:"none", cursor:"pointer", background:"transparent", padding:0 }} />
      </label>
      <div style={{ flex:1 }} />
      {uploadStatus && (
        <span style={{ fontSize: 11, color: P.textMuted, marginRight: 8, whiteSpace: "nowrap" }}>{uploadStatus}</span>
      )}
      <TBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">{ico.undo}</TBtn>
      <TBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">{ico.redo}</TBtn>
      <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" style={{ display: "none" }} onChange={handleImageUpload} />
      <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/ogg,video/quicktime" style={{ display: "none" }} onChange={handleVideoUpload} />
    </div>
  );
}

/* ─── Shared extension config ─── */
function buildExtensions(editable: boolean) {
  return [
    StarterKit.configure({ horizontalRule: false }),
    Underline,
    StyledDivider,
    Link.configure({ openOnClick: !editable }),
    Image.configure({ inline: false, allowBase64: false }),
    Youtube.configure({ width: 540, height: 304, allowFullscreen: true }),
    UploadedVideo,
    TwoColumnLayout,
    ColumnItem,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TextStyle,
    Color,
  ];
}

/* ─── Background presets ─── */
const BG_PRESETS = [
  { label: "White",  value: "#ffffff" },
  { label: "Cream",  value: "#faf8f5" },
  { label: "Slate",  value: "#f8fafc" },
  { label: "Dark",   value: "#1a1a2e" },
  { label: "Night",  value: "#0f172a" },
  { label: "Ink",    value: "#18181b" },
  { label: "Forest", value: "#14532d" },
  { label: "Ocean",  value: "#0c4a6e" },
] as const;

/* ─── Page Editor Modal ─── */
export function PageEditorModal({ pageContent, onSave, onClose }: {
  pageContent: PageContent;
  onSave: (content: PageContent) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const hoveredElRef = useRef<HTMLElement | null>(null);
  const [bgColor, setBgColor] = useState(pageContent.backgroundColor ?? "#ffffff");
  const [pageWidth, setPageWidth] = useState<"small" | "medium" | "full">(pageContent.pageWidth ?? "medium");
  const WIDTH_PX = { small: "520px", medium: "960px", full: "100%" } as const;
  const [dividerVariant, setDividerVariant] = useState<DividerVariant>("solid");
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);

  const editor = useEditor({
    extensions: buildExtensions(true),
    content: (pageContent.tiptapDoc as object | null) ?? EMPTY_DOC,
    immediatelyRender: false,
  });

  const handleSave = useCallback(() => {
    if (!editor) return;
    onSave({ tiptapDoc: editor.getJSON() as Record<string, unknown>, backgroundColor: bgColor, pageWidth });
  }, [editor, bgColor, pageWidth, onSave]);

  const insertTwoColumnRow = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: "twoColumnLayout",
      content: [
        { type: "columnItem", content: [{ type: "paragraph" }] },
        { type: "columnItem", content: [{ type: "paragraph" }] },
      ],
    }).run();
  }, [editor]);

  const insertDivider = useCallback((variant: DividerVariant) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent([
        { type: "styledDivider", attrs: { variant } },
        { type: "paragraph" },
      ])
      .run();
  }, [editor]);

  const getNodePosFromDom = useCallback((el: HTMLElement, names: string[]) => {
    if (!editor) return null;
    let found: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (found !== null) return false;
      if (!names.includes(node.type.name)) return true;
      try {
        const domNode = editor.view.nodeDOM(pos) as HTMLElement | null;
        if (domNode && (domNode === el || domNode.contains(el) || el.contains(domNode))) {
          found = pos;
          return false;
        }
      } catch { /* skip */ }
      return true;
    });
    return found;
  }, [editor]);

  const computeHoverTarget = useCallback((dom: HTMLElement): HoverTarget | null => {
    if (!canvasRef.current) return null;
    const divider = dom.closest('hr[data-divider="true"]') as HTMLElement | null;
    const twoCol = divider ? null : (dom.closest("div[data-two-col]") as HTMLElement | null);
    const img = divider || twoCol ? null : (dom.closest("img") as HTMLElement | null);
    const uploadedVideo = divider || twoCol || img ? null : (dom.closest('video[data-uploaded-video="true"]') as HTMLElement | null);
    const youtube = divider || twoCol || img || uploadedVideo ? null : (dom.closest("iframe") as HTMLElement | null);
    const el = divider ?? twoCol ?? img ?? uploadedVideo ?? youtube;
    if (!el) return null;

    const kind: HoverTarget["kind"] = divider
      ? "divider"
      : twoCol
        ? "twoColumn"
        : img
          ? "image"
          : uploadedVideo
            ? "uploadedVideo"
            : "youtube";
    const nodeNames =
      kind === "divider"
        ? ["styledDivider"]
        : kind === "twoColumn"
          ? ["twoColumnLayout"]
          : kind === "image"
            ? ["image"]
            : kind === "uploadedVideo"
              ? ["uploadedVideo"]
              : ["youtube"];
    const pos = getNodePosFromDom(el, nodeNames);
    if (pos === null) return null;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const targetRect = el.getBoundingClientRect();

    return {
      kind,
      pos,
      top: targetRect.top - canvasRect.top + canvasRef.current.scrollTop - 10,
      right: Math.max(8, canvasRect.right - targetRect.right + 8),
      variant: kind === "divider" ? ((el.getAttribute("data-variant") as DividerVariant | null) ?? "solid") : undefined,
    };
  }, [getNodePosFromDom]);

  const updateHoverFromElement = useCallback((dom: HTMLElement | null) => {
    if (!dom) {
      hoveredElRef.current = null;
      setHoverTarget(null);
      return;
    }
    hoveredElRef.current = dom;
    setHoverTarget(computeHoverTarget(dom));
  }, [computeHoverTarget]);

  const removeHoverNode = useCallback(() => {
    if (!editor || !hoverTarget) return;
    const node = editor.state.doc.nodeAt(hoverTarget.pos);
    if (!node) return;
    editor.chain().focus().setNodeSelection(hoverTarget.pos).deleteSelection().run();
    hoveredElRef.current = null;
    setHoverTarget(null);
  }, [editor, hoverTarget]);

  const updateHoveredDividerType = useCallback((variant: DividerVariant) => {
    setDividerVariant(variant);
    if (!editor || !hoverTarget || hoverTarget.kind !== "divider") return;
    editor.chain().focus().setNodeSelection(hoverTarget.pos).updateAttributes("styledDivider", { variant }).run();
    setHoverTarget({ ...hoverTarget, variant });
  }, [editor, hoverTarget]);

  const vars = useMemo(() => bgVars(bgColor), [bgColor]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <style>{EDITOR_CSS}</style>
      <div style={{ ...modalBase, width: "96vw", maxWidth: 1320, height: "92vh" }} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div style={{
          padding: "10px 20px", borderBottom: `1px solid ${P.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: P.accent }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: P.text }}>Page Builder</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{
              padding: "5px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer",
              border: `1px solid ${P.border}`, borderRadius: 8,
              color: P.textMuted, backgroundColor: P.bg, transition: "all .12s",
            }}>Cancel</button>
            <button onClick={handleSave} style={{
              padding: "5px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: "none", borderRadius: 8,
              color: "#fff", backgroundColor: P.accent, transition: "all .12s",
            }}>Save</button>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <Toolbar editor={editor} onInsertRow={insertTwoColumnRow} onInsertDivider={insertDivider} />

        {/* ── Body: canvas + sidebar ── */}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Canvas */}
          <div className="page-builder page-builder-editor custom-scrollbar"
            ref={canvasRef}
            style={{
              flex: 1, overflowY: "auto",
              backgroundColor: bgColor,
              transition: "background-color .3s ease",
              ...vars as React.CSSProperties,
              ["--pb-bg" as string]: bgColor,
              ["--pb-width" as string]: WIDTH_PX[pageWidth],
            }}
            onMouseMove={(e) => {
              const target = e.target as HTMLElement;
              if (target.closest(".pb-hover-controls")) return;
              try { updateHoverFromElement(target); } catch { /* ignore */ }
            }}
            onMouseLeave={() => updateHoverFromElement(null)}
            onScroll={() => {
              if (hoveredElRef.current) updateHoverFromElement(hoveredElRef.current);
            }}
          >
            <div style={{ position: "relative", minHeight: "100%" }}>
              <EditorContent editor={editor} style={{ minHeight: "100%" }} />
              {hoverTarget && (
                <div
                  className="pb-hover-controls"
                  style={{ top: hoverTarget.top, right: hoverTarget.right }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {hoverTarget.kind === "divider" && (
                    <select
                      className="pb-divider-select"
                      value={hoverTarget.variant ?? dividerVariant}
                      onChange={(e) => updateHoveredDividerType(e.target.value as DividerVariant)}
                    >
                      {(Object.keys(DIVIDER_LABELS) as DividerVariant[]).map((variant) => (
                        <option key={variant} value={variant}>{DIVIDER_LABELS[variant]}</option>
                      ))}
                    </select>
                  )}
                  <button className="pb-danger-btn" onClick={removeHoverNode} title={`Remove ${hoverTarget.kind}`} style={{
                    width: 24,
                    height: 24,
                    padding: 0,
                    borderRadius: 999,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Settings sidebar */}
          <aside className="custom-scrollbar" style={{
            width: 240, borderLeft: `1px solid ${P.border}`,
            backgroundColor: P.bgSoft, padding: 16,
            overflowY: "auto", flexShrink: 0,
            display: "flex", flexDirection: "column", gap: 20,
          }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em", color: P.textDim }}>
              Settings
            </p>

            {/* Background colour */}
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 500, color: P.text }}>Background</label>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "7px 10px", borderRadius: 8,
                border: `1px solid ${P.border}`, backgroundColor: P.bg,
              }}>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                  style={{ width: 26, height: 26, border: `2px solid ${P.border}`, borderRadius: 6, cursor: "pointer", padding: 0 }} />
                <input value={bgColor} onChange={(e) => setBgColor(e.target.value)}
                  style={{ flex: 1, background: "transparent", border: "none", color: P.text, fontSize: 13, fontFamily: "monospace", outline: "none" }} />
              </div>
              {/* Presets */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                {BG_PRESETS.map((p) => (
                  <button key={p.value} onClick={() => setBgColor(p.value)} style={{
                    width: 24, height: 24, borderRadius: 6, cursor: "pointer",
                    backgroundColor: p.value,
                    border: bgColor === p.value ? `2px solid ${P.accent}` : `1px solid ${P.border}`,
                    transition: "border .12s",
                  }} title={p.label} />
                ))}
              </div>
            </div>

            {/* Page width */}
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 500, color: P.text }}>Page width</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["small", "medium", "full"] as const).map((w) => (
                  <button key={w} onClick={() => setPageWidth(w)} style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: pageWidth === w ? `2px solid ${P.accent}` : `1px solid ${P.border}`,
                    backgroundColor: pageWidth === w ? P.accentSoft : P.bg,
                    color: pageWidth === w ? P.accent : P.textSec,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all .12s",
                  }}>{ w === "small" ? "S" : w === "medium" ? "M" : "Full" }</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 500, color: P.text }}>Layout</label>
              <button
                onClick={insertTwoColumnRow}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${P.border}`,
                  backgroundColor: P.bg,
                  color: P.textSec,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                + Add 2-column row
              </button>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 500, color: P.text }}>Divider style</label>
              <select
                className="pb-divider-select"
                value={dividerVariant}
                onChange={(e) => setDividerVariant(e.target.value as DividerVariant)}
                style={{ width: "100%", marginBottom: 8, padding: "8px 10px", fontSize: 12 }}
              >
                {(Object.keys(DIVIDER_LABELS) as DividerVariant[]).map((variant) => (
                  <option key={variant} value={variant}>{DIVIDER_LABELS[variant]}</option>
                ))}
              </select>
              <button
                onClick={() => insertDivider(dividerVariant)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${P.border}`,
                  backgroundColor: P.bg,
                  color: P.textSec,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                + Insert {DIVIDER_LABELS[dividerVariant]} divider
              </button>
            </div>

            <div style={{ flex: 1 }} />

            {/* Tips */}
            <div style={{ padding: 12, backgroundColor: P.bgMuted, borderRadius: 8, border: `1px solid ${P.borderLight}` }}>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: P.textMuted }}>
                <strong style={{ color: P.text }}>Tips</strong><br />
                Use headings to create sections. Upload images, GIFs, and videos, or drop in a YouTube embed to build a rich landing page.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ─── Page Viewer (read-only) ─── */
export function PageViewerModal({ pageContent, onClose }: {
  pageContent: PageContent;
  onClose: () => void;
}) {
  const bg = pageContent.backgroundColor ?? "#ffffff";
  const pw = pageContent.pageWidth ?? "medium";
  const VIEWER_SIZE = {
    small:  { width: "min(520px, 94vw)",  maxHeight: "88vh" },
    medium: { width: "min(960px, 96vw)",  maxHeight: "92vh" },
    full:   { width: "98vw",              maxHeight: "98vh" },
  } as const;
  const vars = useMemo(() => bgVars(bg), [bg]);

  const editor = useEditor({
    extensions: buildExtensions(false),
    content: (pageContent.tiptapDoc as object | null) ?? EMPTY_DOC,
    editable: false,
    immediatelyRender: false,
  });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <style>{EDITOR_CSS}</style>
      <div style={{ ...modalBase, width: VIEWER_SIZE[pw].width, maxHeight: VIEWER_SIZE[pw].maxHeight, position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} title="Close" style={{
          position: "absolute", top: 14, right: 14, zIndex: 10,
          width: 32, height: 32, borderRadius: "50%",
          border: "none",
          backgroundColor: isLight(bg) ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)",
          color: isLight(bg) ? "#52525b" : "#d4d4d8",
          fontSize: 15, fontWeight: 700,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          lineHeight: 1,
          transition: "background .12s",
        }}>✕</button>
        <div className="page-builder custom-scrollbar" style={{
          flex: 1, overflowY: "auto", backgroundColor: bg,
          borderRadius: 14,
          ...vars as React.CSSProperties,
          ["--pb-width" as string]: "100%",
        }}>
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
