"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ─── Toast Notifications ─────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  toast: (type: ToastType, message: string) => void;
  confirm: (message: string, onConfirm: () => void, opts?: { title?: string; confirmText?: string; cancelText?: string }) => void;
  openFeedback: () => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function useNotify() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useNotify must be used inside <NotificationProvider>");
  return ctx;
}

// ─── Confirmation Modal State ────────────────────────

interface ConfirmState {
  open: boolean;
  message: string;
  title: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
}

const defaultConfirm: ConfirmState = {
  open: false,
  message: "",
  title: "Are you sure?",
  confirmText: "Confirm",
  cancelText: "Cancel",
  onConfirm: () => {},
};

// ─── Feedback Modal State ────────────────────────

interface FeedbackState {
  open: boolean;
}

const defaultFeedback: FeedbackState = { open: false };

// ─── Provider ────────────────────────────────────────

let nextId = 0;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>(defaultConfirm);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>(defaultFeedback);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirm = useCallback(
    (message: string, onConfirm: () => void, opts?: { title?: string; confirmText?: string; cancelText?: string }) => {
      setConfirmState({
        open: true,
        message,
        title: opts?.title ?? "Are you sure?",
        confirmText: opts?.confirmText ?? "Confirm",
        cancelText: opts?.cancelText ?? "Cancel",
        onConfirm,
      });
    },
    []
  );

  const closeConfirm = useCallback(() => setConfirmState(defaultConfirm), []);

  const openFeedback = useCallback(() => setFeedbackState({ open: true }), []);
  const closeFeedback = useCallback(() => setFeedbackState(defaultFeedback), []);

  return (
    <Ctx.Provider value={{ toast, confirm, openFeedback }}>
      {children}

      {/* Toast island — bottom-right stack */}
      <div
        className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: 360 }}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>

      {/* Confirmation modal */}
      {confirmState.open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={closeConfirm}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {confirmState.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {confirmState.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeConfirm}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition"
              >
                {confirmState.cancelText}
              </button>
              <button
                onClick={() => {
                  confirmState.onConfirm();
                  closeConfirm();
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition"
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback modal */}
      {feedbackState.open && <FeedbackModal onClose={closeFeedback} />}
    </Ctx.Provider>
  );
}

// ─── Feedback Modal ─────────────────────────────────

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [feedbackType, setFeedbackType] = useState<"general" | "bug" | "feature">("general");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackImage, setFeedbackImage] = useState<string | null>(null);
  const [feedbackImageUploading, setFeedbackImageUploading] = useState(false);
  const [feedbackImageError, setFeedbackImageError] = useState<string | null>(null);

  const sendFeedback = async () => {
    if (!feedbackMsg.trim() && !feedbackImage) return;
    setFeedbackSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: feedbackType, message: feedbackMsg, imageUrl: feedbackImage }),
      });
      if (res.ok) {
        setFeedbackSent(true);
        setFeedbackMsg("");
        setFeedbackImage(null);
      }
    } finally {
      setFeedbackSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        style={{
          background: "#111118",
          borderRadius: 14,
          border: "1px solid #2a2a3e",
          boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {feedbackSent ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div style={{ fontSize: 48 }}>🎉</div>
            <div style={{ color: "#86efac", fontWeight: 700, fontSize: 16 }}>Thanks for your feedback!</div>
            <button
              onClick={() => { setFeedbackSent(false); setFeedbackType("general"); setFeedbackMsg(""); setFeedbackImage(null); }}
              style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #334155", background: "#1a1a2e", color: "#cbd5e1", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              Send another
            </button>
          </div>
        ) : (
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#e0e0e0", letterSpacing: "-0.02em" }}>Send Feedback</h2>
                <p style={{ margin: "4px 0 0", color: "#888", fontSize: 12 }}>Help us improve the editor.</p>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Type selector */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Type</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["general", "bug", "feature"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFeedbackType(t)}
                    style={{
                      flex: 1,
                      padding: "8px 0",
                      borderRadius: 8,
                      border: feedbackType === t ? "2px solid #22c55e" : "2px solid #2a2a3e",
                      background: feedbackType === t ? "#16321f" : "#1a1a2e",
                      color: feedbackType === t ? "#86efac" : "#94a3b8",
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "capitalize" as const,
                      cursor: "pointer",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Message</label>
              <textarea
                value={feedbackMsg}
                onChange={(e) => setFeedbackMsg(e.target.value)}
                placeholder="Describe your feedback..."
                rows={4}
                style={{
                  width: "100%",
                  background: "#1a1a2e",
                  color: "#e5e7eb",
                  border: "2px solid #2a2a3e",
                  borderRadius: 10,
                  padding: "12px 14px",
                  fontSize: 14,
                  resize: "none",
                  outline: "none",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Image upload */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Attach Image (optional)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                id="feedback-img"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setFeedbackImageError(null);
                  if (file.size > 5 * 1024 * 1024) {
                    setFeedbackImageError("Image must be smaller than 5MB");
                    return;
                  }
                  const ext = file.name.split(".").pop()?.toLowerCase();
                  if (!["jpg", "jpeg", "png"].includes(ext ?? "")) {
                    setFeedbackImageError("Only JPG, JPEG, and PNG are allowed");
                    return;
                  }
                  setFeedbackImageUploading(true);
                  try {
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch("/api/feedback/upload", { method: "POST", body: fd });
                    const data = await res.json();
                    if (res.ok && data.url) {
                      setFeedbackImage(data.url);
                    } else {
                      setFeedbackImageError(data.error ?? "Upload failed");
                    }
                  } catch {
                    setFeedbackImageError("Upload failed");
                  } finally {
                    setFeedbackImageUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              {feedbackImage ? (
                <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "2px solid #2a2a3e" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={feedbackImage} alt="Attached" style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
                  <button
                    onClick={() => setFeedbackImage(null)}
                    style={{
                      position: "absolute", top: 8, right: 8,
                      width: 24, height: 24,
                      background: "rgba(239,68,68,0.85)",
                      border: "none", borderRadius: 6,
                      color: "white", fontSize: 12, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="feedback-img"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "14px 0",
                    borderRadius: 10,
                    border: "2px dashed #3a3a52",
                    color: feedbackImageUploading ? "#6b7280" : "#94a3b8",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: feedbackImageUploading ? "default" : "pointer",
                  }}
                >
                  {feedbackImageUploading ? "Uploading..." : "+ Attach Screenshot"}
                </label>
              )}
              {feedbackImageError && (
                <p style={{ color: "#f87171", fontSize: 12, marginTop: 6 }}>{feedbackImageError}</p>
              )}
            </div>

            {/* Send button */}
            <button
              disabled={(!feedbackMsg.trim() && !feedbackImage) || feedbackSending}
              onClick={sendFeedback}
              style={{
                width: "100%",
                padding: "13px 0",
                borderRadius: 10,
                border: "none",
                fontWeight: 700,
                fontSize: 14,
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
                cursor: (!feedbackMsg.trim() && !feedbackImage) || feedbackSending ? "default" : "pointer",
                background: (!feedbackMsg.trim() && !feedbackImage) ? "#1a1a2e" : "#22c55e",
                color: (!feedbackMsg.trim() && !feedbackImage) ? "#94a3b8" : "#062810",
                transition: "all 0.15s",
              }}
            >
              {feedbackSending ? "Sending..." : "Send Feedback"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single Toast Card ───────────────────────────────

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />,
  error: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
};

const borderMap: Record<ToastType, string> = {
  success: "border-emerald-500/30",
  error: "border-red-500/30",
  warning: "border-amber-500/30",
  info: "border-blue-500/30",
};

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timerRef.current);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${borderMap[toast.type]} bg-white dark:bg-gray-900 p-4 shadow-lg animate-in slide-in-from-right-5 fade-in duration-300`}
    >
      {iconMap[toast.type]}
      <p className="text-sm text-gray-800 dark:text-gray-200 flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
