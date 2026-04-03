"use client";

import React, { useState } from "react";
import { useEditorStore } from "../store";
import type { SidePageConfig } from "@mypixelpage/shared";
import { T } from "./theme";

export function WorldSettingsPanel() {
  const worldData = useEditorStore((s) => s.worldData);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleConfigChange = (newConfig: SidePageConfig) => {
    useEditorStore.setState((state) => ({
      worldData: {
        ...state.worldData,
        sidePageConfig: newConfig,
      },
      isDirty: true,
    }));
  };

  const config = worldData.sidePageConfig || {
    enabled: true,
    headerText: "Links",
    links: [],
    backgroundColor: "#f5f5f5",
    textColor: "#333333",
    linkColor: "#0066cc",
    showByDefault: false,
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        style={{
          width: "100%",
          padding: 12,
          backgroundColor: T.sidebarBg,
          border: `1px solid ${T.border}`,
          color: T.textLight,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          borderRadius: 4,
          marginBottom: 8,
        }}
      >
        ⚙️ World Settings
      </button>
    );
  }

  return (
    <div
      style={{
        backgroundColor: T.sidebarBg,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        padding: 12,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>World Settings</h3>
        <button
          onClick={() => setIsExpanded(false)}
          style={{
            background: "none",
            border: "none",
            color: T.textDim,
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: T.textDim }}>
            Enable Side Page
          </label>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) =>
              handleConfigChange({
                ...config,
                enabled: e.target.checked,
              })
            }
            style={{ width: 18, height: 18, cursor: "pointer" }}
          />
        </div>

        {config.enabled && (
          <>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: T.textDim }}>
                Header Text
              </label>
              <input
                type="text"
                value={config.headerText || ""}
                onChange={(e) =>
                  handleConfigChange({
                    ...config,
                    headerText: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  padding: 8,
                  backgroundColor: T.inputBg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 4,
                  color: T.textLight,
                  fontSize: 12,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: T.textDim }}>
                Background Color
              </label>
              <input
                type="color"
                value={config.backgroundColor || "#f5f5f5"}
                onChange={(e) =>
                  handleConfigChange({
                    ...config,
                    backgroundColor: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  height: 36,
                  border: `1px solid ${T.border}`,
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: T.textDim }}>
                Text Color
              </label>
              <input
                type="color"
                value={config.textColor || "#333333"}
                onChange={(e) =>
                  handleConfigChange({
                    ...config,
                    textColor: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  height: 36,
                  border: `1px solid ${T.border}`,
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: T.textDim }}>
                Link Color
              </label>
              <input
                type="color"
                value={config.linkColor || "#0066cc"}
                onChange={(e) =>
                  handleConfigChange({
                    ...config,
                    linkColor: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  height: 36,
                  border: `1px solid ${T.border}`,
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                id="showByDefault"
                checked={config.showByDefault || false}
                onChange={(e) =>
                  handleConfigChange({
                    ...config,
                    showByDefault: e.target.checked,
                  })
                }
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <label
                htmlFor="showByDefault"
                style={{ fontSize: 12, fontWeight: 600, color: T.textDim, cursor: "pointer", margin: 0 }}
              >
                Show by Default
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
