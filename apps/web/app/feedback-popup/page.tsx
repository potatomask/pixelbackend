"use client";

import React, { useState } from "react";

export default function FeedbackPopupPage() {
  const [feedbackType, setFeedbackType] = useState<"general" | "bug" | "feature">("general");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackImage, setFeedbackImage] = useState<string | null>(null);
  const [feedbackImageUploading, setFeedbackImageUploading] = useState(false);
  const [feedbackImageError, setFeedbackImageError] = useState<string | null>(null);

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#0f1117",
    color: "#e2e8f0",
    fontFamily: "system-ui, sans-serif",
    padding: "32px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: 6,
  };

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
          Send Feedback
        </h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 13 }}>
          Help us improve — report a bug, suggest a feature, or just say hi.
        </p>
      </div>

      {feedbackSent ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <div style={{ color: "#34d399", fontWeight: 700, fontSize: 16 }}>Thanks for your feedback!</div>
          <button
            onClick={() => { setFeedbackSent(false); setFeedbackMsg(""); setFeedbackImage(null); setFeedbackType("general"); }}
            style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #334155", background: "#1e293b", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
          >
            Send another
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
          {/* Type selector */}
          <div>
            <label style={labelStyle}>Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["general", "bug", "feature"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFeedbackType(t)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    border: feedbackType === t ? "2px solid #3b82f6" : "2px solid #1e293b",
                    background: feedbackType === t ? "#1e3a5f" : "#1e293b",
                    color: feedbackType === t ? "#93c5fd" : "#64748b",
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "capitalize" as const,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <label style={labelStyle}>Message</label>
            <textarea
              value={feedbackMsg}
              onChange={(e) => setFeedbackMsg(e.target.value)}
              placeholder="Describe your feedback..."
              style={{
                flex: 1,
                minHeight: 120,
                background: "#1e293b",
                color: "#e2e8f0",
                border: "2px solid #334155",
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 14,
                resize: "none",
                outline: "none",
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
              onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
              onBlur={(e) => (e.target.style.borderColor = "#334155")}
            />
          </div>

          {/* Image upload */}
          <div>
            <label style={labelStyle}>Attach Image (optional)</label>
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
              <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: "2px solid #334155" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={feedbackImage} alt="Attached" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
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
                  border: "2px dashed #334155",
                  color: feedbackImageUploading ? "#475569" : "#475569",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: feedbackImageUploading ? "default" : "pointer",
                  transition: "all 0.15s",
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
            onClick={async () => {
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
            }}
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
              background: (!feedbackMsg.trim() && !feedbackImage) ? "#1e293b" : "#10b981",
              color: (!feedbackMsg.trim() && !feedbackImage) ? "#475569" : "#064e3b",
              transition: "all 0.15s",
            }}
          >
            {feedbackSending ? "Sending..." : "Send Feedback"}
          </button>
        </div>
      )}
    </div>
  );
}
