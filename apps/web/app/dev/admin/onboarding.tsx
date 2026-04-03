"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SearchIcon } from "./icons";

const P = {
  card: "#13131f",
  cardBorder: "#1e1e2e",
  bg: "#0b0b12",
  accent: "#6c5ce7",
  accentSoft: "#6c5ce722",
  green: "#00cec9",
  orange: "#fdcb6e",
  rose: "#fd79a8",
  text: "#e0e0e0",
  textDim: "#999",
  textMuted: "#555",
};

interface OnboardingRow {
  id: string;
  source: string;
  sourceOther: string | null;
  useCase: string;
  useCaseOther: string | null;
  createdAt: string;
  user: { id: string; handle: string; email: string; image: string | null };
}

function label(val: string, other: string | null) {
  if (val === "other" && other) return `Other: ${other}`;
  return val.replace(/_/g, " ");
}

function formatDate(raw: string) {
  return new Date(raw).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export function OnboardingTab() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");

  const inputStyle: React.CSSProperties = {
    background: "#0b0b12",
    border: `1px solid ${P.cardBorder}`,
    borderRadius: 8,
    padding: "8px 12px",
    color: P.text,
    fontSize: 13,
    outline: "none",
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/onboarding?${params}`, { cache: "no-store" });
      const json = await res.json();
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [search]);

  const SOURCE_COLORS: Record<string, string> = {
    google: "#34d399",
    bing: "#60a5fa",
    twitter: "#a78bfa",
    other: P.orange,
  };

  const USECASE_COLORS: Record<string, string> = {
    portfolio: "#f472b6",
    landing_page: "#34d399",
    link_in_bio: "#60a5fa",
    other: P.orange,
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: P.text }}>Onboarding Responses</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: P.textDim }}>
          {total} response{total !== 1 ? "s" : ""} recorded.
        </p>
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {Object.entries(SOURCE_COLORS).map(([src, color]) => {
          const count = rows.filter((r) => r.source === src).length;
          return (
            <span key={src} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: color + "22", color, border: `1px solid ${color}44` }}>
              {src}: {count}
            </span>
          );
        })}
        <span style={{ width: 1, background: P.cardBorder, margin: "0 4px" }} />
        {Object.entries(USECASE_COLORS).map(([uc, color]) => {
          const count = rows.filter((r) => r.useCase === uc).length;
          return (
            <span key={uc} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: color + "22", color, border: `1px solid ${color}44` }}>
              {uc.replace(/_/g, " ")}: {count}
            </span>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: "relative", maxWidth: 340, marginBottom: 16 }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: P.textMuted, pointerEvents: "none" }}>
          <SearchIcon size={14} stroke={P.textMuted} strokeWidth={2} />
        </span>
        <input
          type="text"
          placeholder="Search by handle or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
        />
      </div>

      {/* Table */}
      <div style={{ background: P.card, border: `1px solid ${P.cardBorder}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${P.cardBorder}`, textAlign: "left" }}>
                {["User", "How they found us", "Use case", "Date"].map((h, i) => (
                  <th key={i} style={{ padding: "12px 14px", fontSize: 11, fontWeight: 600, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 40, color: P.textMuted }}>Loading…</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 40, color: P.textMuted }}>No onboarding data yet.</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: `1px solid ${P.cardBorder}`, transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff06")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* User */}
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {r.user.image ? (
                        <img src={r.user.image} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: P.accentSoft, border: `1px solid ${P.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#a78bfa" }}>
                          {r.user.handle.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 500, color: P.text }}>/{r.user.handle}</div>
                        <div style={{ fontSize: 11, color: P.textMuted }}>{r.user.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Source */}
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: (SOURCE_COLORS[r.source] ?? P.textMuted) + "22",
                      color: SOURCE_COLORS[r.source] ?? P.textMuted,
                      border: `1px solid ${(SOURCE_COLORS[r.source] ?? P.textMuted)}33`,
                    }}>
                      {label(r.source, r.sourceOther)}
                    </span>
                  </td>

                  {/* Use case */}
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: (USECASE_COLORS[r.useCase] ?? P.textMuted) + "22",
                      color: USECASE_COLORS[r.useCase] ?? P.textMuted,
                      border: `1px solid ${(USECASE_COLORS[r.useCase] ?? P.textMuted)}33`,
                    }}>
                      {label(r.useCase, r.useCaseOther)}
                    </span>
                  </td>

                  {/* Date */}
                  <td style={{ padding: "10px 14px", color: P.textDim, whiteSpace: "nowrap" }}>
                    {formatDate(r.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${P.cardBorder}`, background: "transparent", color: page <= 1 ? P.textMuted : P.textDim, cursor: page <= 1 ? "not-allowed" : "pointer", fontSize: 12 }}
          >
            ← Prev
          </button>
          <span style={{ alignSelf: "center", fontSize: 12, color: P.textDim }}>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${P.cardBorder}`, background: "transparent", color: page >= totalPages ? P.textMuted : P.textDim, cursor: page >= totalPages ? "not-allowed" : "pointer", fontSize: 12 }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
