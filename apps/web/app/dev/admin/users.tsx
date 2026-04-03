"use client";

import React, { useCallback, useEffect, useState } from "react";
import { SearchIcon } from "./icons";

/* ── Types ────────────────────────────────────────── */

interface UserRow {
  id: string;
  email: string;
  handle: string;
  displayName: string | null;
  image: string | null;
  tier: string;
  tierExpiresAt: string | null;
  paidSince: string | null;
  subscriptionStatus: string;
  isAdmin: boolean;
  createdAt: string;
  onboardedAt: string | null;
  dashboardTourCompletedAt: string | null;
  editorTourCompletedAt: string | null;
  _count: { worlds: number };
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  totalPages: number;
}

/* ── Palette (matching overview) ──────────────────── */

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
  free: "#6b7280",
  starter: "#6c5ce7",
  pro: "#fdcb6e",
  tester: "#22c55e",
};

const TIERS = ["ALL", "FREE", "STARTER", "PRO", "TESTER"] as const;
const PAGE_SIZE = 20;

/* ── Helpers ──────────────────────────────────────── */

function formatDate(raw: string | null): string {
  if (!raw) return "—";
  return new Date(raw).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function tierColor(tier: string): string {
  if (tier === "TESTER") return P.tester;
  if (tier === "PRO") return P.pro;
  if (tier === "STARTER") return P.starter;
  return P.free;
}

/* ── Users Component ──────────────────────────────── */

export function UsersTab() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  // Editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTier, setEditTier] = useState<string>("");
  const [resettingOnboardingId, setResettingOnboardingId] = useState<string | null>(null);
  const [resettingDashboardTourId, setResettingDashboardTourId] = useState<string | null>(null);
  const [resettingEditorTourId, setResettingEditorTourId] = useState<string | null>(null);

  const handleResetOnboarding = async (userId: string) => {
    setResettingOnboardingId(userId);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, resetOnboarding: true }),
    });
    setResettingOnboardingId(null);
    fetchUsers();
  };

  const handleResetDashboardTour = async (userId: string) => {
    setResettingDashboardTourId(userId);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, resetDashboardTour: true }),
    });
    setResettingDashboardTourId(null);
    fetchUsers();
  };

  const handleResetEditorTour = async (userId: string) => {
    setResettingEditorTourId(userId);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, resetEditorTour: true }),
    });
    setResettingEditorTourId(null);
    fetchUsers();
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (tierFilter !== "ALL") params.set("tier", tierFilter);
    if (search.trim()) params.set("search", search.trim());
    try {
      const res = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [page, tierFilter, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Debounced search: reset page when search/filter change
  useEffect(() => { setPage(1); }, [search, tierFilter]);

  const handleSaveTier = async (userId: string) => {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, tier: editTier }),
    });
    setEditingId(null);
    fetchUsers();
  };

  const inputStyle: React.CSSProperties = {
    background: "#0b0b12",
    border: `1px solid ${P.cardBorder}`,
    borderRadius: 8,
    padding: "8px 12px",
    color: P.text,
    fontSize: 13,
    outline: "none",
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: P.text }}>User Management</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: P.textDim }}>
          Browse, search, and manage registered users.
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 260px" }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: P.textMuted,
              pointerEvents: "none",
            }}
          >
            <SearchIcon size={14} stroke={P.textMuted} strokeWidth={2} />
          </span>
          <input
            type="text"
            placeholder="Search by handle or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: "100%", paddingLeft: 32 }}
          />
        </div>

        {/* Tier filter */}
        <div style={{ display: "flex", gap: 4 }}>
          {TIERS.map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border:
                  tierFilter === t
                    ? `1px solid ${P.accent}`
                    : `1px solid ${P.cardBorder}`,
                background: tierFilter === t ? P.accentSoft : "transparent",
                color: tierFilter === t ? "#a78bfa" : P.textDim,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
                transition: "all 0.15s",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Total */}
        {data && (
          <span style={{ fontSize: 12, color: P.textMuted, marginLeft: "auto" }}>
            {data.total} user{data.total !== 1 ? "s" : ""} found
          </span>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          background: P.card,
          border: `1px solid ${P.cardBorder}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${P.cardBorder}`,
                  textAlign: "left",
                }}
              >
                {["User", "Email", "Tier", "Status", "Onboarded", "Dashboard Tour", "Editor Tour", "Access End", "Paid Since", "Joined", "Worlds", ""].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "12px 14px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: P.textMuted,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !data && (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: 40, color: P.textMuted }}>
                    Loading...
                  </td>
                </tr>
              )}
              {data && data.users.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: "center", padding: 40, color: P.textMuted }}>
                    No users match your filters
                  </td>
                </tr>
              )}
              {data?.users.map((u) => {
                const tc = tierColor(u.tier);
                const isEditing = editingId === u.id;
                return (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom: `1px solid ${P.cardBorder}`,
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#ffffff06")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* User */}
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {u.image ? (
                          <img
                            src={u.image}
                            alt=""
                            style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: "50%",
                              background: `linear-gradient(135deg, ${tc}44, ${tc}22)`,
                              border: `1px solid ${tc}44`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 700,
                              color: tc,
                            }}
                          >
                            {u.handle.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 500, color: P.text }}>
                            /{u.handle}
                            {u.isAdmin && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: 9,
                                  background: P.rose + "22",
                                  color: P.rose,
                                  padding: "1px 6px",
                                  borderRadius: 10,
                                  fontWeight: 600,
                                }}
                              >
                                ADMIN
                              </span>
                            )}
                          </div>
                          {u.displayName && (
                            <div style={{ fontSize: 11, color: P.textMuted }}>{u.displayName}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: "10px 14px", color: P.textDim }}>{u.email}</td>

                    {/* Tier */}
                    <td style={{ padding: "10px 14px" }}>
                      {isEditing ? (
                        <select
                          value={editTier}
                          onChange={(e) => setEditTier(e.target.value)}
                          style={{
                            ...inputStyle,
                            padding: "4px 8px",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          {["FREE", "STARTER", "PRO", "TESTER"].map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 10px",
                            borderRadius: 20,
                            background: tc + "22",
                            color: tc,
                            border: `1px solid ${tc}33`,
                          }}
                        >
                          {u.tier}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      {u.subscriptionStatus === "active" && (
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: P.green + "22", color: P.green, border: `1px solid ${P.green}33` }}>
                          Active
                        </span>
                      )}
                      {u.subscriptionStatus === "canceled" && (
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: P.orange + "22", color: P.orange, border: `1px solid ${P.orange}33` }}>
                          Canceled
                        </span>
                      )}
                      {u.subscriptionStatus === "none" && (
                        <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: P.textMuted + "22", color: P.textMuted, border: `1px solid ${P.textMuted}33` }}>
                          None
                        </span>
                      )}
                    </td>

                    {/* Onboarded */}
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {u.onboardedAt ? (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: P.green + "22", color: P.green, border: `1px solid ${P.green}33` }}>
                            Done
                          </span>
                        ) : (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: P.rose + "22", color: P.rose, border: `1px solid ${P.rose}33` }}>
                            Pending
                          </span>
                        )}
                        {u.onboardedAt && (
                          <button
                            onClick={() => handleResetOnboarding(u.id)}
                            disabled={resettingOnboardingId === u.id}
                            title="Reset onboarding (for re-testing)"
                            style={{
                              padding: "2px 8px",
                              borderRadius: 6,
                              border: `1px solid ${P.rose}55`,
                              background: P.rose + "12",
                              color: P.rose,
                              cursor: "pointer",
                              fontSize: 10,
                              fontWeight: 500,
                              opacity: resettingOnboardingId === u.id ? 0.5 : 1,
                            }}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Dashboard tour */}
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {u.dashboardTourCompletedAt ? (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: P.green + "22", color: P.green, border: `1px solid ${P.green}33` }}>
                            Done
                          </span>
                        ) : (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: P.rose + "22", color: P.rose, border: `1px solid ${P.rose}33` }}>
                            Pending
                          </span>
                        )}
                        {u.dashboardTourCompletedAt && (
                          <button
                            onClick={() => handleResetDashboardTour(u.id)}
                            disabled={resettingDashboardTourId === u.id}
                            title="Reset dashboard tour (for re-testing)"
                            style={{
                              padding: "2px 8px",
                              borderRadius: 6,
                              border: `1px solid ${P.orange}55`,
                              background: P.orange + "12",
                              color: P.orange,
                              cursor: "pointer",
                              fontSize: 10,
                              fontWeight: 500,
                              opacity: resettingDashboardTourId === u.id ? 0.5 : 1,
                            }}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Editor tour */}
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {u.editorTourCompletedAt ? (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: P.green + "22", color: P.green, border: `1px solid ${P.green}33` }}>
                            Done
                          </span>
                        ) : (
                          <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: P.rose + "22", color: P.rose, border: `1px solid ${P.rose}33` }}>
                            Pending
                          </span>
                        )}
                        {u.editorTourCompletedAt && (
                          <button
                            onClick={() => handleResetEditorTour(u.id)}
                            disabled={resettingEditorTourId === u.id}
                            title="Reset editor tour (for re-testing)"
                            style={{
                              padding: "2px 8px",
                              borderRadius: 6,
                              border: `1px solid ${P.orange}55`,
                              background: P.orange + "12",
                              color: P.orange,
                              cursor: "pointer",
                              fontSize: 10,
                              fontWeight: 500,
                              opacity: resettingEditorTourId === u.id ? 0.5 : 1,
                            }}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Access End */}
                    <td style={{ padding: "10px 14px", color: P.textDim, whiteSpace: "nowrap" }}>
                      {u.tierExpiresAt ? (
                        <span style={{ color: P.orange }}>
                          {new Date(u.tierExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      ) : (
                        <span style={{ color: P.textMuted }}>—</span>
                      )}
                    </td>

                    {/* Paid Since */}
                    <td style={{ padding: "10px 14px", color: P.textDim, whiteSpace: "nowrap" }}>
                      {formatDate(u.paidSince)}
                    </td>

                    {/* Joined */}
                    <td style={{ padding: "10px 14px", color: P.textDim, whiteSpace: "nowrap" }}>
                      {formatDate(u.createdAt)}
                    </td>

                    {/* Worlds */}
                    <td style={{ padding: "10px 14px", color: P.textDim, textAlign: "center" }}>
                      {u._count.worlds}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => handleSaveTier(u.id)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: `1px solid ${P.green}66`,
                              background: P.green + "18",
                              color: P.green,
                              cursor: "pointer",
                              fontSize: 11,
                              fontWeight: 500,
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: `1px solid ${P.cardBorder}`,
                              background: "transparent",
                              color: P.textDim,
                              cursor: "pointer",
                              fontSize: 11,
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(u.id);
                            setEditTier(u.tier);
                          }}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: `1px solid ${P.cardBorder}`,
                            background: "transparent",
                            color: P.textDim,
                            cursor: "pointer",
                            fontSize: 11,
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = P.accent;
                            e.currentTarget.style.color = "#a78bfa";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = P.cardBorder;
                            e.currentTarget.style.color = P.textDim;
                          }}
                        >
                          Edit Tier
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${P.cardBorder}`,
              background: "transparent",
              color: page <= 1 ? P.textMuted : P.textDim,
              cursor: page <= 1 ? "not-allowed" : "pointer",
              fontSize: 12,
            }}
          >
            ← Prev
          </button>

          {Array.from({ length: Math.min(data.totalPages, 7) }, (_, i) => {
            let pageNum: number;
            if (data.totalPages <= 7) {
              pageNum = i + 1;
            } else if (page <= 4) {
              pageNum = i + 1;
            } else if (page >= data.totalPages - 3) {
              pageNum = data.totalPages - 6 + i;
            } else {
              pageNum = page - 3 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border:
                    page === pageNum
                      ? `1px solid ${P.accent}`
                      : `1px solid ${P.cardBorder}`,
                  background: page === pageNum ? P.accentSoft : "transparent",
                  color: page === pageNum ? "#a78bfa" : P.textDim,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: page === pageNum ? 600 : 400,
                  minWidth: 32,
                }}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: `1px solid ${P.cardBorder}`,
              background: "transparent",
              color: page >= data.totalPages ? P.textMuted : P.textDim,
              cursor: page >= data.totalPages ? "not-allowed" : "pointer",
              fontSize: 12,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
