"use client";

import React, { useCallback, useEffect, useState } from "react";

const P = {
  card: "#13131f",
  cardBorder: "#1e1e2e",
  accent: "#6c5ce7",
  accentSoft: "#6c5ce722",
  rose: "#fd79a8",
  text: "#e0e0e0",
  textDim: "#999",
  textMuted: "#555",
};

const SETTINGS_KEY = "reserved-paths";

const SYSTEM_PATHS = [
  "api", "dashboard", "dev", "admin", "login", "signin", "signup",
  "settings", "tile", "test", "public", "static", "_next",
];

export function SettingsTab() {
  const [reservedPaths, setReservedPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [error, setError] = useState("");

  const fetchPaths = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/settings?key=${SETTINGS_KEY}`, { cache: "no-store" });
      const json = await res.json();
      if (json.value) {
        const parsed = typeof json.value === "string" ? JSON.parse(json.value) : json.value;
        setReservedPaths(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPaths(); }, [fetchPaths]);

  const savePaths = async (paths: string[]) => {
    setSaving(true);
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: SETTINGS_KEY, value: paths }),
      });
      setReservedPaths(paths);
    } catch {
      setError("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const addPath = () => {
    const cleaned = newPath.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!cleaned) {
      setError("Path can only contain letters, numbers, hyphens, and underscores.");
      return;
    }
    if (cleaned.length < 2) {
      setError("Path must be at least 2 characters.");
      return;
    }
    if (reservedPaths.includes(cleaned) || SYSTEM_PATHS.includes(cleaned)) {
      setError("This path is already reserved.");
      return;
    }
    setError("");
    const updated = [...reservedPaths, cleaned].sort();
    savePaths(updated);
    setNewPath("");
  };

  const removePath = (path: string) => {
    savePaths(reservedPaths.filter((p) => p !== path));
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: P.text }}>Settings</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: P.textDim }}>
          Manage site-wide settings and reserved paths.
        </p>
      </div>

      <div style={{ background: P.card, border: `1px solid ${P.cardBorder}`, borderRadius: 12, padding: 24, maxWidth: 640 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 600, color: P.text }}>Reserved Paths</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: P.textDim, lineHeight: 1.5 }}>
          Usernames matching these paths will be blocked. Users cannot claim &quot;website.com/<strong>path</strong>&quot; for any reserved path.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Add reserved path…"
            value={newPath}
            onChange={(e) => { setNewPath(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPath(); } }}
            style={{
              flex: 1,
              padding: "8px 12px",
              background: "#1e1e2e",
              border: `1px solid ${P.cardBorder}`,
              borderRadius: 8,
              color: P.text,
              fontSize: 13,
              outline: "none",
            }}
          />
          <button
            onClick={addPath}
            disabled={saving || !newPath.trim()}
            style={{
              padding: "8px 16px",
              background: P.accent,
              border: "none",
              borderRadius: 8,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving || !newPath.trim() ? "not-allowed" : "pointer",
              opacity: saving || !newPath.trim() ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : "Add"}
          </button>
        </div>

        {error && (
          <p style={{ margin: "0 0 12px", fontSize: 12, color: P.rose }}>{error}</p>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            System Reserved (always blocked)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {SYSTEM_PATHS.map((p) => (
              <span
                key={p}
                style={{
                  padding: "4px 10px",
                  background: "#1e1e2e",
                  borderRadius: 6,
                  fontSize: 12,
                  color: P.textDim,
                  fontFamily: "monospace",
                }}
              >
                /{p}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: P.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
            Custom Reserved ({reservedPaths.length})
          </div>
          {loading ? (
            <div style={{ color: P.textDim, fontSize: 13 }}>Loading…</div>
          ) : reservedPaths.length === 0 ? (
            <div style={{ color: P.textDim, fontSize: 13, fontStyle: "italic" }}>No custom reserved paths yet.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {reservedPaths.map((p) => (
                <span
                  key={p}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    background: P.accentSoft,
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#a78bfa",
                    fontFamily: "monospace",
                  }}
                >
                  /{p}
                  <button
                    onClick={() => removePath(p)}
                    disabled={saving}
                    style={{
                      background: "none",
                      border: "none",
                      color: P.rose,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 700,
                      lineHeight: 1,
                      padding: 0,
                      opacity: saving ? 0.5 : 1,
                    }}
                    title={`Remove /${p}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}