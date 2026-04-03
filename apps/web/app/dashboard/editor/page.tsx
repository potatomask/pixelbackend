"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useState } from "react";
import { useNotify } from "@/components/notifications";

// Lazy-load editor to keep main bundle small
const EditorShell = dynamic(
  () => import("@mypixelpage/editor").then((mod) => ({ default: mod.EditorShell })),
  { ssr: false, loading: () => <EditorLoading /> }
);

type EditorTourStep = {
  key: string;
  title: string;
  description: string;
  selector?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
};

const EDITOR_TOUR_STEPS: EditorTourStep[] = [
  {
    key: "left-palette",
    title: "Tile Palette (Left)",
    description: "This is where you browse and select tiles to paint on your world. You can scroll, search, and organize your tileset here.",
    selector: "[data-tour-left-palette]",
    position: "right",
  },
  {
    key: "canvas",
    title: "Canvas Area",
    description: "The main editing area. Click and drag to paint tiles, use the tools in the toolbar to edit your world.",
    selector: "[data-tour-canvas]",
    position: "center",
  },
  {
    key: "right-props",
    title: "Properties Panel (Right)",
    description: "Shows detailed properties for selected objects. You can edit positions, colors, interactions, and more here.",
    selector: "[data-tour-right-props]",
    position: "left",
  },
  {
    key: "toolbar-draw",
    title: "Draw Tool",
    description: "Click to enable the draw tool and paint tiles onto your world. You can paint by clicking and dragging.",
    selector: "[data-tour-toolbar-draw]",
    position: "bottom",
  },
  {
    key: "toolbar-erase",
    title: "Erase Tool",
    description: "Click to enable the erase tool and remove tiles from your world.",
    selector: "[data-tour-toolbar-erase]",
    position: "bottom",
  },
  {
    key: "toolbar-spawn",
    title: "Spawn Tool",
    description: "Click to enable the spawn tool and place objects or characters into your world.",
    selector: "[data-tour-toolbar-spawn]",
    position: "bottom",
  },
  {
    key: "toolbar-select",
    title: "Select Tool",
    description: "Click to enable the select tool and choose objects to edit their properties.",
    selector: "[data-tour-toolbar-select]",
    position: "bottom",
  },
  {
    key: "toolbar-save",
    title: "Save Button",
    description: "You MUST save your work periodically or all changes will be lost. Click this button to save. There is no auto-save, so remember to save before leaving!",
    selector: "[data-tour-toolbar-save]",
    position: "bottom",
  },
  {
    key: "toolbar-play",
    title: "Play Button",
    description: "Click to preview your world. Press P or click STOP to exit preview mode.",
    selector: "[data-tour-toolbar-play]",
    position: "bottom",
  },
  {
    key: "sidebar-page-button",
    title: "Side Page Toggle",
    description: "Click this button to open or close the side page panel where you can configure page links and content for the side of your world.",
    selector: "[data-tour-sidebar-toggle-button]",
    position: "left",
  },
  {
    key: "home-button",
    title: "Home Button",
    description: "Click to return to your dashboard. Make sure to save your work first!",
    selector: "[data-tour-home-button]",
    position: "bottom",
  },
  {
    key: "feedback-button",
    title: "Feedback",
    description: "Found a bug or have a suggestion? Click here to send us feedback directly from the editor.",
    selector: "[data-tour-feedback-button]",
    position: "bottom",
  },
];

function EditorLoading() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-950 text-gray-400 overflow-hidden">
      <div className="text-center flex flex-col items-center gap-6">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-2 border-4 border-emerald-500 border-b-transparent rounded-full animate-[spin_1.5s_linear_infinite_reverse]"></div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 animate-pulse tracking-wider uppercase">Loading Engine</h2>
          <p className="text-xs text-gray-500 font-mono tracking-widest uppercase">Initializing Canvas Subsystem...</p>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  const { openFeedback } = useNotify();
  const [editorTourReady, setEditorTourReady] = useState(false);
  const [editorTourCompleted, setEditorTourCompleted] = useState(true);
  const [editorTourPromptOpen, setEditorTourPromptOpen] = useState(false);
  const [editorTourStarted, setEditorTourStarted] = useState(false);
  const [editorTourStepIndex, setEditorTourStepIndex] = useState(0);
  const [editorTourRect, setEditorTourRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const currentEditorTourStep = editorTourCompleted || !editorTourStarted
    ? null
    : EDITOR_TOUR_STEPS[editorTourStepIndex];

  useEffect(() => {
    const loadEditorTourStatus = async () => {
      try {
        const res = await fetch("/api/editor-tour", { cache: "no-store" });
        const data = await res.json();
        if (data.completed) {
          setEditorTourCompleted(true);
          setEditorTourPromptOpen(false);
          setEditorTourStarted(false);
        } else {
          setEditorTourCompleted(false);
          setEditorTourPromptOpen(true);
          setEditorTourStarted(false);
          setEditorTourStepIndex(0);
        }
      } catch {
        setEditorTourCompleted(true);
      } finally {
        setEditorTourReady(true);
      }
    };

    loadEditorTourStatus();
  }, []);

  const updateEditorTourRect = useCallback(() => {
    if (!currentEditorTourStep?.selector) {
      setEditorTourRect(null);
      return;
    }

    const element = document.querySelector(currentEditorTourStep.selector) as HTMLElement;
    if (!element) {
      setEditorTourRect(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setEditorTourRect(null);
      return;
    }

    setEditorTourRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
  }, [currentEditorTourStep]);

  useEffect(() => {
    if (!editorTourReady || editorTourCompleted || !editorTourStarted) return;

    const syncRect = () => {
      requestAnimationFrame(() => updateEditorTourRect());
    };

    syncRect();
    const intervalId = window.setInterval(syncRect, 250);
    window.addEventListener("resize", syncRect);
    window.addEventListener("scroll", syncRect, true);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("resize", syncRect);
      window.removeEventListener("scroll", syncRect, true);
    };
  }, [editorTourReady, editorTourCompleted, editorTourStarted, editorTourStepIndex, updateEditorTourRect]);

  const completeEditorTour = useCallback(async () => {
    setEditorTourCompleted(true);
    setEditorTourPromptOpen(false);
    setEditorTourStarted(false);
    setEditorTourRect(null);

    try {
      await fetch("/api/editor-tour", {
        method: "PATCH",
        keepalive: true,
      });
    } catch {
      // Ignore persistence failures so the UI doesn't get stuck.
    }
  }, []);

  const startEditorTour = useCallback(() => {
    setEditorTourPromptOpen(false);
    setEditorTourStarted(true);
    setEditorTourStepIndex(0);
    requestAnimationFrame(() => updateEditorTourRect());
  }, [updateEditorTourRect]);

  const advanceEditorTour = useCallback(() => {
    if (editorTourCompleted) return;

    const nextIndex = editorTourStepIndex + 1;
    if (nextIndex >= EDITOR_TOUR_STEPS.length) {
      void completeEditorTour();
      return;
    }

    setEditorTourStepIndex(nextIndex);
  }, [completeEditorTour, editorTourCompleted, editorTourStepIndex]);

  const spotlightRect = editorTourRect
    ? {
        top: Math.max(8, editorTourRect.top - 10),
        left: Math.max(8, editorTourRect.left - 10),
        width: editorTourRect.width + 20,
        height: editorTourRect.height + 20,
      }
    : null;

  let editorTourCardStyle: React.CSSProperties = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(360px, calc(100vw - 2rem))",
  };

  if (spotlightRect && typeof window !== "undefined") {
    const cardWidth = Math.min(360, window.innerWidth - 32);
    const estimatedCardHeight = 230;
    const belowTop = spotlightRect.top + spotlightRect.height + 16;
    const top = belowTop + estimatedCardHeight <= window.innerHeight - 16
      ? belowTop
      : Math.max(16, spotlightRect.top - estimatedCardHeight - 16);
    const left = Math.min(
      Math.max(16, spotlightRect.left),
      Math.max(16, window.innerWidth - cardWidth - 16),
    );

    editorTourCardStyle = {
      top,
      left,
      width: cardWidth,
    };
  }

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <EditorShell openFeedback={openFeedback} />

      {editorTourReady && !editorTourCompleted && editorTourPromptOpen && !editorTourStarted && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 px-4 dark:bg-black/70"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border-2 border-slate-800 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.35)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <div className="mb-3 inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
              Welcome
            </div>
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">Welcome To The Editor</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Want a quick guided tour of the editor tools and panels?
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => void completeEditorTour()}
                className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                onClick={startEditorTour}
                className="rounded-xl border-2 border-slate-800 bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-400 dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Start Tour
              </button>
            </div>
          </div>
        </div>
      )}

      {editorTourReady && !editorTourCompleted && editorTourStarted && currentEditorTourStep && (
        <>
          <div className="pointer-events-none fixed inset-0" style={{ position: "fixed", zIndex: 9998 }}>
            {spotlightRect ? (
              <div
                className="absolute rounded-2xl border-4 border-emerald-400 transition-all duration-200 dark:shadow-[0_0_0_9999px_rgba(0,0,0,0.75)]"
                style={{
                  top: spotlightRect.top,
                  left: spotlightRect.left,
                  width: spotlightRect.width,
                  height: spotlightRect.height,
                  boxShadow: "0 0 0 9999px rgba(15,23,42,0.58)",
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-slate-950/55 dark:bg-black/65" />
            )}
          </div>

          <div
            className="pointer-events-auto fixed rounded-2xl border-2 border-slate-800 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.28)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_18px_60px_rgba(0,0,0,0.6)]"
            style={{ ...editorTourCardStyle, zIndex: 9999 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="mb-3 inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
              Editor Tour {editorTourStepIndex + 1}/{EDITOR_TOUR_STEPS.length}
            </div>
            <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{currentEditorTourStep.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{currentEditorTourStep.description}</p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void completeEditorTour()}
                className="rounded-xl border-2 border-slate-300 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Skip Tour
              </button>
              <button
                type="button"
                onClick={advanceEditorTour}
                className="rounded-xl border-2 border-slate-800 bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-400 dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {editorTourStepIndex + 1 >= EDITOR_TOUR_STEPS.length ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
