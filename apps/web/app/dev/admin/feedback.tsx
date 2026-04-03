"use client";

import React, { useCallback, useEffect, useState } from "react";
import { MessageSquareIcon, SearchIcon } from "./icons";

/* ── Types ────────────────────────────────────────── */

interface FeedbackRow {
  id: string;
  type: string;
  message: string;
  status: string;
  createdAt: string;
  user: { handle: string; email: string };
}

/* ── Palette (matching users tab) ─────────────────── */

const P = {
  card: "#13131f",
  cardBorder: "#1e1e2e",
  accent: "#6c5ce7",
  accentSoft: "#6c5ce722",
  green: "#00cec9",
  orange: "#fdcb6e",
  rose: "#fd79a8",
  text: "#e0e0e0",
  textDim: "#999",
  textMuted: "#555",
};

const STATUS_OPTIONS = ["new", "reviewed", "resolved"] as const;
const TYPE_FILTERS = ["ALL", "general", "bug", "feature"] as const;

type ParsedFeedback = {
  text: string;
  imageUrl: string | null;
};

/* ── Helpers ──────────────────────────────────────── */

function formatDate(raw: string): string {
  return new Date(raw).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function parseFeedbackMessage(raw: string): ParsedFeedback {
  const match = raw.match(/\[\[feedback-image:(.+?)\]\]/);
  const imageUrl = match?.[1] ?? null;
  const text = raw.replace(/\n?\n?\[\[feedback-image:.+?\]\]/, "").trim();
  return { text, imageUrl };
}

function typeBadge(type: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    bug: { bg: "#fd79a822", text: P.rose },
    feature: { bg: "#6c5ce722", text: "#a78bfa" },
    general: { bg: "#00cec916", text: P.green },
  };
  const c = colors[type] ?? colors.general!;
  return (
    <span style={{ background: c.bg, color: c.text, padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>
      {type}
    </span>
  );
}

function statusBadge(status: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    new: { bg: "#fdcb6e22", text: P.orange },
    reviewed: { bg: "#6c5ce722", text: "#a78bfa" },
    resolved: { bg: "#00cec916", text: P.green },
  };
  const c = colors[status] ?? colors.new!;
  return (
    <span style={{ background: c.bg, color: c.text, padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

/* ── FeedbackTab Component ────────────────────────── */

export function FeedbackTab() {
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", { cache: "no-store" });
      const json = await res.json();
      setFeedbacks(json.feedbacks || []);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFeedbacks(); }, [fetchFeedbacks]);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f)));
      }
    } catch {
      /* noop */
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteFeedback = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedbacks((prev) => prev.filter((f) => f.id !== id));
      }
    } catch {
      /* noop */
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered list
  const filtered = feedbacks.filter((f) => {
    const parsed = parseFeedbackMessage(f.message);
    if (typeFilter !== "ALL" && f.type !== typeFilter) return false;
    if (statusFilter !== "ALL" && f.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return parsed.text.toLowerCase().includes(q) || f.user.handle.toLowerCase().includes(q) || f.user.email.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    total: feedbacks.length,
    new: feedbacks.filter((f) => f.status === "new").length,
    bug: feedbacks.filter((f) => f.type === "bug").length,
    feature: feedbacks.filter((f) => f.type === "feature").length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: P.text }}>Feedback</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: P.textDim }}>
          Review user-submitted feedback, bug reports, and feature requests.
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total", value: counts.total, color: P.accent },
          { label: "New", value: counts.new, color: P.orange },
          { label: "Bugs", value: counts.bug, color: P.rose },
          { label: "Features", value: counts.feature, color: "#a78bfa" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: P.card,
              border: `1px solid ${P.cardBorder}`,
              borderRadius: 10,
              padding: "14px 20px",
              minWidth: 100,
            }}
          >
            <div style={{ fontSize: 11, color: P.textDim, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 320 }}>
          <SearchIcon size={14} stroke="#666" style={{ position: "absolute", left: 10, top: 10 }} />
          <input
            type="text"
            placeholder="Search feedback…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 32px",
              background: P.card,
              border: `1px solid ${P.cardBorder}`,
              borderRadius: 8,
              color: P.text,
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        {/* Type filter */}
        <div style={{ display: "flex", gap: 4 }}>
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: 6,
                background: typeFilter === t ? P.accentSoft : "transparent",
                color: typeFilter === t ? "#a78bfa" : P.textDim,
                fontSize: 12,
                fontWeight: typeFilter === t ? 600 : 400,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t === "ALL" ? "All Types" : t}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div style={{ display: "flex", gap: 4 }}>
          {(["ALL", ...STATUS_OPTIONS] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: 6,
                background: statusFilter === s ? P.accentSoft : "transparent",
                color: statusFilter === s ? "#a78bfa" : P.textDim,
                fontSize: 12,
                fontWeight: statusFilter === s ? 600 : 400,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {s === "ALL" ? "All Status" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: P.card, border: `1px solid ${P.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: P.textDim, fontSize: 13 }}>Loading feedback…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <MessageSquareIcon size={32} stroke="#555" style={{ margin: "0 auto 8px" }} />
            <div style={{ color: P.textDim, fontSize: 13 }}>No feedback found.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${P.cardBorder}` }}>
                {["User", "Type", "Message", "Status", "Date", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 600,
                      color: P.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} style={{ borderBottom: `1px solid ${P.cardBorder}` }}>
                  <td style={{ padding: "10px 14px", color: P.text, whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 600 }}>@{f.user.handle}</div>
                    <div style={{ fontSize: 11, color: P.textDim }}>{f.user.email}</div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>{typeBadge(f.type)}</td>
                  <td style={{ padding: "10px 14px", color: P.text, maxWidth: 360 }}>
                    {(() => {
                      const parsed = parseFeedbackMessage(f.message);
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {parsed.text ? (
                            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{parsed.text}</div>
                          ) : (
                            <div style={{ color: P.textDim, fontStyle: "italic" }}>Image-only feedback</div>
                          )}
                          {parsed.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={parsed.imageUrl}
                              alt="Feedback attachment"
                              style={{
                                width: 96,
                                height: 96,
                                objectFit: "cover",
                                borderRadius: 8,
                                border: `1px solid ${P.cardBorder}`,
                                background: "#0b0b12",
                              }}
                            />
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "10px 14px" }}>{statusBadge(f.status)}</td>
                  <td style={{ padding: "10px 14px", color: P.textDim, whiteSpace: "nowrap", fontSize: 12 }}>
                    {formatDate(f.createdAt)}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <select
                        value={f.status}
                        disabled={updatingId === f.id || deletingId === f.id}
                        onChange={(e) => updateStatus(f.id, e.target.value)}
                        style={{
                          padding: "4px 8px",
                          background: "#1e1e2e",
                          border: `1px solid ${P.cardBorder}`,
                          borderRadius: 6,
                          color: P.text,
                          fontSize: 12,
                          cursor: "pointer",
                          outline: "none",
                          opacity: updatingId === f.id || deletingId === f.id ? 0.5 : 1,
                        }}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => deleteFeedback(f.id)}
                        disabled={deletingId === f.id || updatingId === f.id}
                        style={{
                          padding: "5px 10px",
                          background: "#fd79a822",
                          border: `1px solid ${P.rose}44`,
                          borderRadius: 6,
                          color: P.rose,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: deletingId === f.id || updatingId === f.id ? "not-allowed" : "pointer",
                          opacity: deletingId === f.id || updatingId === f.id ? 0.5 : 1,
                        }}
                      >
                        {deletingId === f.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
