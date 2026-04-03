"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";

/* ── Types ─────────────────────────────────────────── */

interface TableInfo {
  name: string;
  count: number;
}

interface PaginatedResponse {
  records: Record<string, any>[];
  total: number;
  page: number;
  totalPages: number;
}

/* ── Styles ────────────────────────────────────────── */

const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "#111118",
  color: "#e0e0e0",
  fontFamily: "system-ui, sans-serif",
  display: "flex",
};

const sidebarStyle: React.CSSProperties = {
  width: 240,
  background: "#0d0d14",
  borderRight: "1px solid #222",
  padding: "20px 0",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  height: "100vh",
  position: "sticky",
  top: 0,
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  padding: "28px 32px",
  overflow: "auto",
  minHeight: "100vh",
};

/* ── Component ─────────────────────────────────────── */

export default function DatabasePage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, any>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState("");

  // Fetch table list
  useEffect(() => {
    fetch("/api/admin/db", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTables(d.tables || []))
      .catch(() => {});
  }, []);

  // Fetch records when table/page/search changes
  const fetchRecords = useCallback(async () => {
    if (!selectedTable) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ table: selectedTable, page: String(page), limit: "25" });
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/db?${params}`, { cache: "no-store" });
      const data: PaginatedResponse = await res.json();
      setRecords(data.records || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setError("Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [selectedTable, page, search]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Select a table
  function handleSelectTable(name: string) {
    setSelectedTable(name);
    setPage(1);
    setSearch("");
    setEditingCell(null);
  }

  // Start editing a cell
  function startEdit(id: string, field: string, currentValue: any) {
    setEditingCell({ id, field });
    setEditValue(currentValue === null || currentValue === undefined ? "" : String(currentValue));
  }

  // Save edit
  async function saveEdit() {
    if (!editingCell || !selectedTable) return;
    const { id, field } = editingCell;

    // Try to parse as appropriate type
    let parsedValue: any = editValue;
    if (editValue === "true") parsedValue = true;
    else if (editValue === "false") parsedValue = false;
    else if (editValue === "null") parsedValue = null;
    else if (/^\d+$/.test(editValue)) parsedValue = parseInt(editValue, 10);
    else if (/^\d+\.\d+$/.test(editValue)) parsedValue = parseFloat(editValue);

    try {
      const res = await fetch("/api/admin/db", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: selectedTable, id, data: { [field]: parsedValue } }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Update failed");
      } else {
        setEditingCell(null);
        fetchRecords();
      }
    } catch {
      setError("Update failed");
    }
  }

  // Delete record
  async function handleDelete(id: string) {
    if (!selectedTable) return;
    try {
      const res = await fetch(`/api/admin/db?table=${selectedTable}&id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Delete failed");
      } else {
        fetchRecords();
        // Refresh table counts
        fetch("/api/admin/db", { cache: "no-store" })
          .then((r) => r.json())
          .then((d) => setTables(d.tables || []));
      }
    } catch {
      setError("Delete failed");
    }
  }

  // Get column keys from records
  const columns = records.length > 0 ? Object.keys(records[0]!) : [];

  return (
    <div style={pageBg}>
      {/* ── Sidebar ─────────────────────────────────── */}
      <div style={sidebarStyle}>
        <div style={{ padding: "0 16px 16px", borderBottom: "1px solid #222" }}>
          <Link
            href="/dev"
            style={{
              color: "#888",
              textDecoration: "none",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 12,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Dev Tools
          </Link>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e0e0e0" }}>Database</h2>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#666" }}>SQLite · Prisma ORM</p>
        </div>

        <div style={{ padding: "12px 8px", flex: 1, overflow: "auto" }}>
          {tables.map((t) => (
            <button
              key={t.name}
              onClick={() => handleSelectTable(t.name)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "8px 12px",
                border: "none",
                borderRadius: 8,
                background: selectedTable === t.name ? "#8b5cf620" : "transparent",
                color: selectedTable === t.name ? "#a78bfa" : "#ccc",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: selectedTable === t.name ? 600 : 400,
                textAlign: "left",
                transition: "all 0.1s",
                marginBottom: 2,
              }}
            >
              <span style={{ textTransform: "capitalize" }}>{t.name}</span>
              <span
                style={{
                  fontSize: 11,
                  color: "#666",
                  background: "#1a1a2e",
                  padding: "2px 8px",
                  borderRadius: 10,
                  fontWeight: 500,
                }}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────── */}
      <div style={mainStyle}>
        {!selectedTable ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", gap: 12 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v14a9 3 0 0018 0V5" />
              <path d="M3 12a9 3 0 0018 0" />
            </svg>
            <h2 style={{ margin: 0, fontSize: 18, color: "#888" }}>Select a table</h2>
            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>Choose a table from the sidebar to browse records</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, textTransform: "capitalize" }}>
                  {selectedTable}
                </h1>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666" }}>
                  {total} record{total !== 1 ? "s" : ""}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#666"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search records..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    style={{
                      background: "#1a1a2e",
                      border: "1px solid #333",
                      borderRadius: 8,
                      padding: "8px 12px 8px 32px",
                      color: "#e0e0e0",
                      fontSize: 13,
                      width: 220,
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div style={{ background: "#ff4d4f15", border: "1px solid #ff4d4f30", borderRadius: 8, padding: "8px 14px", marginBottom: 16, color: "#ff6b6b", fontSize: 13 }}>
                {error}
                <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", color: "#ff6b6b", cursor: "pointer" }}>
                  ×
                </button>
              </div>
            )}

            {/* Table */}
            <div style={{ borderRadius: 12, border: "1px solid #222", overflow: "hidden" }}>
              <div style={{ overflow: "auto", maxHeight: "calc(100vh - 200px)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col}
                          style={{
                            padding: "10px 14px",
                            textAlign: "left",
                            background: "#0d0d14",
                            borderBottom: "1px solid #222",
                            color: "#888",
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            whiteSpace: "nowrap",
                            position: "sticky",
                            top: 0,
                            zIndex: 1,
                          }}
                        >
                          {col}
                        </th>
                      ))}
                      <th
                        style={{
                          padding: "10px 14px",
                          textAlign: "center",
                          background: "#0d0d14",
                          borderBottom: "1px solid #222",
                          color: "#888",
                          fontWeight: 600,
                          fontSize: 11,
                          textTransform: "uppercase",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                          width: 60,
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={columns.length + 1} style={{ padding: 40, textAlign: "center", color: "#555" }}>
                          Loading...
                        </td>
                      </tr>
                    ) : records.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length + 1} style={{ padding: 40, textAlign: "center", color: "#555" }}>
                          No records found
                        </td>
                      </tr>
                    ) : (
                      records.map((record, idx) => (
                        <tr key={record.id ?? idx} style={{ borderBottom: "1px solid #1a1a2e" }}>
                          {columns.map((col) => {
                            const isEditing = editingCell?.id === record.id && editingCell?.field === col;
                            const val = record[col];
                            const display =
                              val === null
                                ? "null"
                                : val === true
                                  ? "true"
                                  : val === false
                                    ? "false"
                                    : typeof val === "object"
                                      ? JSON.stringify(val).slice(0, 80)
                                      : String(val).slice(0, 120);

                            return (
                              <td
                                key={col}
                                style={{
                                  padding: "8px 14px",
                                  color: val === null ? "#555" : col === "id" ? "#8b5cf6" : "#ccc",
                                  fontFamily: col === "id" || col === "userId" || col === "ownerId" ? "monospace" : "inherit",
                                  fontSize: col === "id" || col === "userId" || col === "ownerId" ? 11 : 13,
                                  whiteSpace: "nowrap",
                                  maxWidth: 300,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  cursor: col !== "id" ? "pointer" : "default",
                                  fontStyle: val === null ? "italic" : "normal",
                                }}
                                onDoubleClick={() => {
                                  if (col !== "id") startEdit(record.id, col, val);
                                }}
                              >
                                {isEditing ? (
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <input
                                      autoFocus
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") saveEdit();
                                        if (e.key === "Escape") setEditingCell(null);
                                      }}
                                      style={{
                                        background: "#1a1a2e",
                                        border: "1px solid #8b5cf6",
                                        borderRadius: 4,
                                        padding: "2px 6px",
                                        color: "#e0e0e0",
                                        fontSize: 12,
                                        width: "100%",
                                        outline: "none",
                                      }}
                                    />
                                    <button
                                      onClick={saveEdit}
                                      style={{
                                        background: "#8b5cf6",
                                        border: "none",
                                        borderRadius: 4,
                                        color: "white",
                                        padding: "2px 8px",
                                        cursor: "pointer",
                                        fontSize: 11,
                                      }}
                                    >
                                      Save
                                    </button>
                                  </div>
                                ) : (
                                  display
                                )}
                              </td>
                            );
                          })}
                          <td style={{ padding: "8px 14px", textAlign: "center" }}>
                            <button
                              onClick={() => handleDelete(record.id)}
                              title="Delete record"
                              style={{
                                background: "none",
                                border: "1px solid #333",
                                borderRadius: 6,
                                color: "#888",
                                cursor: "pointer",
                                padding: "4px 8px",
                                fontSize: 11,
                                transition: "all 0.1s",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLElement).style.borderColor = "#ff4d4f";
                                (e.currentTarget as HTMLElement).style.color = "#ff4d4f";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.borderColor = "#333";
                                (e.currentTarget as HTMLElement).style.color = "#888";
                              }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 20 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{
                    background: "#1a1a2e",
                    border: "1px solid #333",
                    borderRadius: 8,
                    padding: "6px 14px",
                    color: page <= 1 ? "#444" : "#ccc",
                    cursor: page <= 1 ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: 13, color: "#888" }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{
                    background: "#1a1a2e",
                    border: "1px solid #333",
                    borderRadius: 8,
                    padding: "6px 14px",
                    color: page >= totalPages ? "#444" : "#ccc",
                    cursor: page >= totalPages ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  Next
                </button>
              </div>
            )}

            <p style={{ marginTop: 16, fontSize: 11, color: "#444", textAlign: "center" }}>
              Double-click a cell to edit. Press Enter to save, Escape to cancel.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
