"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SearchIcon, DoorIcon } from "./icons";

/* ── Types ────────────────────────────────────────── */

interface CancelFeedbackRow {
  id: string;
  reason: string;
  comment: string | null;
  prevTier: string;
  status: string;
  createdAt: string;
  user: { handle: string; email: string; tier: string };
}

/* ── Palette ──────────────────────────────────────── */

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

/* ── Helpers ──────────────────────────────────────── */

function formatDate(raw: string): string {
  return new Date(raw).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

function tierBadge(tier: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    STARTER: { bg: "#6c5ce722", text: "#a78bfa" },
    PRO: { bg: "#00cec916", text: P.green },
    FREE: { bg: "#55555522", text: P.textMuted },
  };
  const c = colors[tier] ?? colors.FREE!;
  return (
    <span style={{ background: c.bg, color: c.text, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
      {tier}
    </span>
  );
}

const REASON_LABELS: Record<string, string> = {
  "too-expensive": "Too expensive",
  "missing-features": "Missing features",
  "not-using": "Not using it",
  "switched-service": "Switched to another service",
  "temporary": "Temporary / won't need it",
  "found-free-alternative": "Found a free alternative",
  "other": "Other",
};

/* ── CancelFeedbackTab Component ──────────────────── */

export function CancelFeedbackTab() {
  const [feedbacks, setFeedbacks] = useState<CancelFeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cancel-feedback", { cache: "no-store" });
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
      const res = await fetch("/api/admin/cancel-feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
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

  const filtered = feedbacks.filter((f) => {
    if (statusFilter !== "ALL" && f.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        f.user.handle.toLowerCase().includes(q) ||
        f.user.email.toLowerCase().includes(q) ||
        f.reason.toLowerCase().includes(q) ||
        (f.comment && f.comment.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const counts = {
    total: feedbacks.length,
    new: feedbacks.filter((f) => f.status === "new").length,
    reviewed: feedbacks.filter((f) => f.status === "reviewed").length,
    resolved: feedbacks.filter((f) => f.status === "resolved").length,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: P.text }}>Cancel Feedback</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: P.textDim }}>
          See why users cancel their subscriptions.
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Total", value: counts.total, color: P.accent },
          { label: "New", value: counts.new, color: P.orange },
          { label: "Reviewed", value: counts.reviewed, color: "#a78bfa" },
          { label: "Resolved", value: counts.resolved, color: P.green },
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
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 320 }}>
          <SearchIcon size={14} stroke="#666" style={{ position: "absolute", left: 10, top: 10 }} />
          <input
            type="text"
            placeholder="Search by user or reason…"
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

        <div style={{ display: "flex", gap: 4 }}>
          {(["ALL", "new", "reviewed", "resolved"] as const).map((s) => (
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
          <div style={{ padding: 40, textAlign: "center", color: P.textDim, fontSize: 13 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <DoorIcon size={32} stroke="#555" style={{ margin: "0 auto 8px" }} />
            <div style={{ color: P.textDim, fontSize: 13 }}>No cancel feedback yet.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${P.cardBorder}` }}>
                {["User", "Previous Tier", "Reason", "Comment", "Status", "Date", ""].map((h) => (
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
                  <td style={{ padding: "10px 14px" }}>{tierBadge(f.prevTier)}</td>
                  <td style={{ padding: "10px 14px", color: P.text }}>
                    {REASON_LABELS[f.reason] ?? f.reason}
                  </td>
                  <td style={{ padding: "10px 14px", color: f.comment ? P.text : P.textDim, maxWidth: 240 }}>
                    {f.comment ? (
                      <span style={{ whiteSpace: "pre-wrap" }}>{f.comment}</span>
                    ) : (
                      <span style={{ fontStyle: "italic" }}>No comment</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>{statusBadge(f.status)}</td>
                  <td style={{ padding: "10px 14px", color: P.textDim, whiteSpace: "nowrap", fontSize: 12 }}>
                    {formatDate(f.createdAt)}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <select
                      value={f.status}
                      disabled={updatingId === f.id}
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
                        opacity: updatingId === f.id ? 0.5 : 1,
                      }}
                    >
                      {["new", "reviewed", "resolved"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
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
