"use client";

import React, { useEffect } from "react";
import { useEditorStore } from "../store";
import { isEditableTarget } from "../utils/isEditableTarget";
import type { EditorTool } from "@mypixelpage/shared";
import { Brush, Eraser, Cuboid, Undo2, Redo2, Play, Square, MousePointer2, Save, MessageSquare, Home } from "lucide-react";

const TOOLS: { id: EditorTool; label: string; key: string; icon: React.ReactNode }[] = [
  { id: "brush",    label: "Draw",    key: "B", icon: <Brush size={18} /> },
  { id: "eraser",   label: "Erase",   key: "E", icon: <Eraser size={18} /> },
  { id: "spawn",    label: "Spawn",   key: "S", icon: <Cuboid size={18} /> },
  { id: "selector", label: "Select",  key: "V", icon: <MousePointer2 size={18} /> },
];

export function Toolbar({ isPreview, setIsPreview, openFeedback }: { isPreview: boolean; setIsPreview: (val: boolean) => void; openFeedback?: () => void }) {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const isDirty = useEditorStore((s) => s.isDirty);
  const isSaving = useEditorStore((s) => s.isSaving);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const tileCount = useEditorStore((s) => s.tileCount);
  const saveWorld = useEditorStore((s) => s.saveWorld);

  const [pressedTool, setPressedTool] = React.useState<EditorTool | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const upper = e.key.toUpperCase();
      for (const t of TOOLS) {
        if (upper === t.key && !e.ctrlKey && !e.metaKey) { setTool(t.id); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveWorld(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTool, undo, redo, saveWorld]);

  return (
    <header
      className="flex justify-between items-center bg-slate-900 px-4 py-3 shrink-0 z-10 font-mono text-slate-200"
      style={{ display: isPreview ? "none" : undefined }}
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-slate-400 hover:text-emerald-400 transition-colors" title="Back to Dashboard" data-tour-home-button>
            <Home size={20} />
          </a>
          <h1 className="m-0 text-lg sm:text-xl font-bold tracking-widest uppercase flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-sm animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)] border border-emerald-400"></div>
            Editor
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700/50 shadow-inner rounded text-xs uppercase tracking-wider text-slate-400">
          <span>Tiles: {tileCount}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-slate-950/50 p-1.5 rounded-lg border border-slate-800 shadow-inner">
        {!isPreview && TOOLS.map((t) => {
          const active = t.id === "spawn" ? (tool === "spawn" || tool === "object") : tool === t.id;
          const pressed = pressedTool === t.id;
          const dataTourAttr = t.id === "brush" ? "data-tour-toolbar-draw" : t.id === "eraser" ? "data-tour-toolbar-erase" : t.id === "spawn" ? "data-tour-toolbar-spawn" : t.id === "selector" ? "data-tour-toolbar-select" : undefined;
          return (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              onMouseDown={() => setPressedTool(t.id)}
              onMouseUp={() => setPressedTool(null)}
              onMouseLeave={() => setPressedTool(null)}
              title={`${t.label} (${t.key})`}
              {...(dataTourAttr ? { [dataTourAttr]: true } : {})}
              className="flex items-center gap-2 px-3 py-2 rounded transition-all duration-150 text-xs uppercase font-bold tracking-wider"
              style={{
                transform: pressed ? "scale(0.96)" : "scale(1)",
                background: active ? "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)" : "transparent",
                color: active ? "#ffffff" : "#cbd5e1",
                border: active ? "1px solid rgba(147,197,253,0.95)" : "1px solid transparent",
                boxShadow: active ? "0 0 0 2px rgba(147,197,253,0.45), 0 0 16px rgba(59,130,246,0.45)" : "none",
              }}
              aria-pressed={active}
              aria-label={`${t.label} tool`}
            >
              {t.icon}
              <span>{t.label}</span>
              {active && (
                <span className="inline-block h-2 w-2 rounded-full bg-white/95 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              )}
            </button>
          );
        })}

        {!isPreview && <div className="w-px h-6 bg-slate-700 mx-1" />}

        {!isPreview && (
          <button
            onClick={saveWorld}
            disabled={!isDirty || isSaving}
            title="Save (Ctrl+S)"
            data-tour-toolbar-save
            className={`flex items-center gap-2 px-4 py-2 rounded transition-all text-xs uppercase font-bold tracking-wider ${
              isDirty 
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30" 
                : "text-slate-500 bg-slate-800/50 cursor-not-allowed border border-transparent"
            }`}
          >
            <Save size={16} />
            <span>
              {isSaving ? "Saving…" : isDirty ? "Save" : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Saved"}
            </span>
          </button>
        )}

        <div className="w-px h-6 bg-slate-700 mx-1" />

        <button
          onClick={() => setIsPreview(!isPreview)}
          data-tour-toolbar-play
          className={`flex items-center gap-2 px-4 py-2 rounded transition-all text-xs uppercase font-bold tracking-wider shadow-sm ${
            isPreview 
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]" 
              : "bg-emerald-600 text-slate-950 hover:bg-emerald-500 border border-emerald-500 hover:shadow-[0_0_10px_rgba(16,185,129,0.3)]"
          }`}
        >
          {isPreview ? <><Square size={16} className="fill-current" /> <span>Stop</span></> : <><Play size={16} className="fill-current" /> <span>Play</span></>}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => openFeedback?.()}
            title="Send Feedback"
            data-tour-feedback-button
            className="flex items-center gap-2 px-3 py-2 rounded transition-all text-xs uppercase font-bold tracking-wider text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent"
          >
            <MessageSquare size={16} /> <span>Feedback</span>
          </button>
        </div>
        
        <div className="w-px h-6 bg-slate-800 mx-1" />
        
        <div className="flex items-center gap-1 bg-slate-800/50 p-1 rounded-lg border border-slate-800">
          <button onClick={undo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded transition-colors ${undoStack.length === 0 ? "text-slate-600 cursor-not-allowed" : "text-slate-300 hover:bg-slate-700 hover:text-white"}`}>
            <Undo2 size={18} />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} title="Redo (Ctrl+Y)"
            className={`p-1.5 rounded transition-colors ${redoStack.length === 0 ? "text-slate-600 cursor-not-allowed" : "text-slate-300 hover:bg-slate-700 hover:text-white"}`}>
            <Redo2 size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}