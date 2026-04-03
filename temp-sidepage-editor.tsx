"use client";

import React, { useState, useEffect } from "react";
import type { SidePageTheme } from "@mypixelpage/shared";

const STORAGE_KEY = "dev-sidepage-themes";

const DEFAULT_THEME: SidePageTheme = {
  id: "default",
  name: "Default Modern",
  isDefault: true,
  tiles: {},
  buttons: {
    link: {},
    settings: {},
  },
};

function loadThemes(): SidePageTheme[] {
  if (typeof window === "undefined") return [DEFAULT_THEME];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [DEFAULT_THEME];
  } catch {
    return [DEFAULT_THEME];
  }
}

function saveThemes(themes: SidePageTheme[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
}

const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "#111118",
  color: "#e0e0e0",
  padding: "24px 32px",
  fontFamily: "system-ui, sans-serif",
};

const cardStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  background: "#222",
  border: "1px solid #444",
  color: "#fff",
  padding: "6px 12px",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
  marginTop: 4,
};

export default function SidepageEditorPage() {
  const [themes, setThemes] = useState<SidePageTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadThemes();
    setThemes(loaded);
    if (loaded && loaded.length > 0 && loaded[0]) {
      setSelectedThemeId(loaded[0].id);
    }
  }, []);

  const handleCreateTheme = () => {
    const newTheme: SidePageTheme = {
      id: `theme-${Date.now()}`,
      name: "New Theme",
      isDefault: false,
      tiles: {},
      buttons: { link: {}, settings: {} },
    };
    const updated = [...themes, newTheme];
    setThemes(updated);
    saveThemes(updated);
    setSelectedThemeId(newTheme.id);
  };

  const handleDeleteTheme = (id: string) => {
    const updated = themes.filter((t) => t.id !== id);
    setThemes(updated);
    saveThemes(updated);
    if (selectedThemeId === id) {
      setSelectedThemeId(updated[0]?.id || null);
    }
  };

  const updateSelectedTheme = (updates: Partial<SidePageTheme>) => {
    const updated = themes.map((t) => (t.id === selectedThemeId ? { ...t, ...updates } : t));
    setThemes(updated);
    saveThemes(updated);
  };

  const updateTiles = (key: keyof SidePageTheme["tiles"], val: string) => {
    const theme = themes.find((t) => t.id === selectedThemeId);
    if (!theme) return;
    updateSelectedTheme({ tiles: { ...theme.tiles, [key]: val } });
  };

  const updateButtons = (btn: keyof SidePageTheme["buttons"], key: "bg" | "icon", val: string) => {
    const theme = themes.find((t) => t.id === selectedThemeId);
    if (!theme) return;
    updateSelectedTheme({
      buttons: {
        ...theme.buttons,
        [btn]: { ...theme.buttons[btn], [key]: val },
      },
    });
  };

  const setAsDefault = (id: string) => {
    const updated = themes.map(t => ({
      ...t,
      isDefault: t.id === id
    }));
    setThemes(updated);
    saveThemes(updated);
  };

  const selectedTheme = themes.find((t) => t.id === selectedThemeId);

  return (
    <div style={pageBg}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: "0 0 8px" }}>Sidepage Theme Editor</h1>
          <p style={{ color: "#888", margin: 0 }}>Configure the appearance of the bio link side panel.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
            <a href="/dev/world-editor" style={{
              background: "#333", color: "#ccc", textDecoration: "none",
              padding: "8px 16px", borderRadius: 8, fontWeight: 600
            }}>
              ← Back to Dev
            </a>
            <button onClick={handleCreateTheme} style={{
              background: "#3b82f6", color: "white", border: "none",
              padding: "8px 16px", borderRadius: 8, fontWeight: 600, cursor: "pointer"
            }}>
              + Create Theme
            </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24 }}>
        {/* Sidebar */}
        <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 12 }}>
          {themes.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedThemeId(t.id)}
              style={{
                ...cardStyle,
                marginBottom: 0,
                cursor: "pointer",
                borderColor: t.id === selectedThemeId ? "#3b82f6" : "#333",
                background: t.id === selectedThemeId ? "#1e293b" : "#1a1a2e",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                {t.isDefault && <span style={{ fontSize: 10, background: "#22c55e", padding: "2px 6px", borderRadius: 4 }}>Default</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Editor */}
        {selectedTheme ? (
          <div style={{ ...cardStyle, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ flex: 1, marginRight: 20 }}>
                <label style={{ fontSize: 12, color: "#888" }}>Theme Name</label>
                <input
                  style={inputStyle}
                  value={selectedTheme.name}
                  onChange={(e) => updateSelectedTheme({ name: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
                {!selectedTheme.isDefault && (
                  <button onClick={() => setAsDefault(selectedTheme.id)} style={{
                    background: "#22c55e", color: "white", border: "none", padding: "8px 16px", borderRadius: 6, cursor: "pointer"
                  }}>
                    Set as Default
                  </button>
                )}
                {!selectedTheme.isDefault && (
                  <button onClick={() => handleDeleteTheme(selectedTheme.id)} style={{
                    background: "#ef4444", color: "white", border: "none", padding: "8px 16px", borderRadius: 6, cursor: "pointer"
                  }}>
                    Delete Theme
                  </button>
                )}
              </div>
            </div>

            <h3 style={{ borderBottom: "1px solid #333", paddingBottom: 8, marginTop: 32 }}>Panel Tiles (9-slice paths/IDs)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {(["topLeft", "top", "topRight", "left", "center", "right", "bottomLeft", "bottom", "bottomRight"] as const).map((pos) => (
                <div key={pos}>
                  <label style={{ fontSize: 12, color: "#888" }}>{pos}</label>
                  <input
                    style={inputStyle}
                    value={selectedTheme.tiles[pos] || ""}
                    onChange={(e) => updateTiles(pos, e.target.value)}
                    placeholder="Image src or color"
                  />
                </div>
              ))}
            </div>

            <h3 style={{ borderBottom: "1px solid #333", paddingBottom: 8, marginTop: 32 }}>Button UI</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              <div>
                <h4 style={{ margin: "0 0 12px", color: "#ccc" }}>Link Button</h4>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: "#888" }}>Background</label>
                  <input style={inputStyle} value={selectedTheme.buttons.link.bg || ""} onChange={(e) => updateButtons("link", "bg", e.target.value)} placeholder="#3b82f6 or url()" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#888" }}>Icon</label>
                  <input style={inputStyle} value={selectedTheme.buttons.link.icon || ""} onChange={(e) => updateButtons("link", "icon", e.target.value)} placeholder="Image src" />
                </div>
              </div>
              <div>
                <h4 style={{ margin: "0 0 12px", color: "#ccc" }}>Settings Button</h4>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: "#888" }}>Background</label>
                  <input style={inputStyle} value={selectedTheme.buttons.settings.bg || ""} onChange={(e) => updateButtons("settings", "bg", e.target.value)} placeholder="#334155 or url()" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "#888" }}>Icon</label>
                  <input style={inputStyle} value={selectedTheme.buttons.settings.icon || ""} onChange={(e) => updateButtons("settings", "icon", e.target.value)} placeholder="Image src" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ ...cardStyle, flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "#888" }}>
            Select or create a theme to edit
          </div>
        )}
      </div>
    </div>
  );
}
