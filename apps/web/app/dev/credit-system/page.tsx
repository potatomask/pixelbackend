"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { CreditConfig, UserTier, CategoryDef } from "@mypixelpage/shared";
import { CREDIT_CONFIG_KEY, loadCreditConfig } from "@mypixelpage/shared";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { loadSettingFromServer, autoHealSettings } from "@/lib/utils/dev-settings-sync";
import {
  STORAGE_LIMITS_KEY,
  STORAGE_LIMITS,
  normalizeStorageLimits,
  type StorageLimitConfig,
} from "@/lib/storage";

/* ── Constants ─────────────────────────────────────── */

const CATEGORIES_KEY = "dev-categories";

const TIERS: { id: UserTier; label: string; color: string; desc: string }[] = [
  { id: "FREE", label: "Free", color: "#6b7280", desc: "Default tier for all new users" },
  { id: "STARTER", label: "Starter", color: "#3b82f6", desc: "Paid starter plan" },
  { id: "PRO", label: "Pro", color: "#f59e0b", desc: "Full access pro plan" },
  { id: "TESTER", label: "Tester", color: "#22c55e", desc: "Internal manual tier (not public)" },
];

/* ── Helpers ───────────────────────────────────────── */

/** Count total items in a category tree (self + all descendants). */
function countTreeItems(cat: CategoryDef): number {
  let n = cat.items.length;
  if (cat.children) for (const c of cat.children) n += countTreeItems(c);
  return n;
}

/* ── Persistence ───────────────────────────────────── */

function loadCategories(): CategoryDef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCreditConfig(config: CreditConfig) {
  localStorage.setItem(CREDIT_CONFIG_KEY, JSON.stringify(config));
}

/* ── Styles ────────────────────────────────────────── */

const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "#111118",
  color: "#e0e0e0",
  padding: "24px 32px",
  fontFamily: "system-ui, sans-serif",
};

const tierCardStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 12,
  padding: 20,
  flex: 1,
  minWidth: 280,
};

const inputStyle: React.CSSProperties = {
  background: "#111118",
  border: "1px solid #444",
  borderRadius: 6,
  padding: "4px 8px",
  color: "#e0e0e0",
  width: 70,
  textAlign: "right",
  fontSize: 13,
};

const btnStyle: React.CSSProperties = {
  padding: "8px 18px",
  borderRadius: 8,
  border: "none",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

/* ── Component ─────────────────────────────────────── */

export default function CreditSystemPage() {
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [config, setConfig] = useState<CreditConfig>({ FREE: {}, STARTER: {}, PRO: {}, TESTER: {} });
  const [storageLimits, setStorageLimits] = useState<StorageLimitConfig>(STORAGE_LIMITS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load categories from server first, then fall back to localStorage
    loadSettingFromServer("dev-categories").then((serverVal) => {
      setCategories(loadCategories());
      autoHealSettings([["dev-categories", serverVal]]);
    });
    // Try loading credit config from DB first, fall back to localStorage
    fetch("/api/admin/settings?key=" + CREDIT_CONFIG_KEY)
      .then((r) => r.json())
      .then((data: { value: string | null }) => {
        if (data.value) {
          const parsed = JSON.parse(data.value) as CreditConfig;
          setConfig(parsed);
          // Keep localStorage in sync
          saveCreditConfig(parsed);
        } else {
          setConfig(loadCreditConfig());
        }
      })
      .catch(() => setConfig(loadCreditConfig()));

    fetch("/api/admin/settings?key=" + STORAGE_LIMITS_KEY)
      .then((r) => r.json())
      .then((data: { value: string | null }) => {
        if (!data.value) {
          setStorageLimits(STORAGE_LIMITS);
          return;
        }
        const parsed = normalizeStorageLimits(JSON.parse(data.value));
        setStorageLimits(parsed);
        localStorage.setItem(STORAGE_LIMITS_KEY, JSON.stringify(parsed));
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem(STORAGE_LIMITS_KEY);
          setStorageLimits(raw ? normalizeStorageLimits(JSON.parse(raw)) : STORAGE_LIMITS);
        } catch {
          setStorageLimits(STORAGE_LIMITS);
        }
      });
  }, []);

  const handleChange = useCallback(
    (tier: UserTier, categoryId: string, value: string) => {
      const num = value === "" ? 0 : parseInt(value, 10);
      if (isNaN(num) || num < 0) return;
      setConfig((prev) => ({
        ...prev,
        [tier]: { ...prev[tier], [categoryId]: num },
      }));
      setSaved(false);
    },
    [],
  );

  const handleSave = useCallback(() => {
    saveCreditConfig(config);
    localStorage.setItem(STORAGE_LIMITS_KEY, JSON.stringify(storageLimits));

    // Persist to DB so all users get the correct limits
    Promise.all([
      fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: CREDIT_CONFIG_KEY, value: JSON.stringify(config) }),
      }),
      fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: STORAGE_LIMITS_KEY, value: JSON.stringify(storageLimits) }),
      }),
    ]).catch(console.error);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [config, storageLimits]);

  const handleStorageLimitChange = useCallback((tier: UserTier, value: string) => {
    const mb = value === "" ? 0 : parseInt(value, 10);
    if (isNaN(mb) || mb <= 0) return;

    setStorageLimits((prev) => ({
      ...prev,
      [tier]: mb * 1024 * 1024,
    }));
    setSaved(false);
  }, []);

  return (
    <div style={pageBg}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link
          href="/dev"
          style={{
            color: "#888",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
          }}
        >
          <ArrowLeft size={14} /> Back
        </Link>
        <h1 style={{ margin: 0, fontSize: 22 }}>💳 Credit System Editor</h1>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleSave}
          style={{
            ...btnStyle,
            background: saved ? "#22c55e" : "#3b82f6",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Save size={14} />
          {saved ? "Saved!" : "Save"}
        </button>
      </div>

      <p style={{ color: "#888", fontSize: 13, marginBottom: 24, maxWidth: 600 }}>
        Set the maximum number of items a user can place from each root category, based on their tier.
        All items in subcategories count toward the root category&apos;s limit.
        A value of <strong>0</strong> means <strong>no limit</strong> for that category.
      </p>

      <div style={{ ...tierCardStyle, marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 16 }}>Storage Limits (MB)</h2>
        <p style={{ margin: "0 0 14px 0", color: "#888", fontSize: 12 }}>
          Controls upload storage cap per tier. This is used by media upload/storage APIs.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(120px, 1fr))", gap: 10 }}>
          {TIERS.map((tier) => (
            <label
              key={tier.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                background: "#111118",
                border: "1px solid #2f2f46",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              <span style={{ color: tier.color, fontWeight: 700, fontSize: 12 }}>{tier.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  min={1}
                  style={inputStyle}
                  value={Math.max(1, Math.round((storageLimits[tier.id] ?? STORAGE_LIMITS[tier.id]) / (1024 * 1024)))}
                  onChange={(e) => handleStorageLimitChange(tier.id, e.target.value)}
                />
                <span style={{ fontSize: 11, color: "#777" }}>MB</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {categories.length === 0 && (
        <div
          style={{
            ...tierCardStyle,
            textAlign: "center",
            padding: 40,
            color: "#888",
          }}
        >
          No categories found. Create categories in the{" "}
          <Link href="/dev/world-editor/categories" style={{ color: "#3b82f6" }}>
            Category Editor
          </Link>{" "}
          first.
        </div>
      )}

      {categories.length > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          {TIERS.map((tier) => (
            <div key={tier.id} style={tierCardStyle}>
              {/* Tier header */}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "inline-block",
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: tier.color + "22",
                    border: `1px solid ${tier.color}55`,
                    color: tier.color,
                    fontWeight: 700,
                    fontSize: 15,
                    marginBottom: 4,
                  }}
                >
                  {tier.label}
                </div>
                <div style={{ color: "#666", fontSize: 12 }}>{tier.desc}</div>
              </div>

              {/* Category rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 10px",
                      borderRadius: 6,
                      background: "#111118",
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: cat.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 13 }}>{cat.name}</span>
                    <span style={{ fontSize: 11, color: "#666", marginRight: 4 }}>
                      {countTreeItems(cat)} items
                    </span>
                    <input
                      type="number"
                      min={0}
                      style={inputStyle}
                      value={config[tier.id]?.[cat.id] ?? 0}
                      onChange={(e) => handleChange(tier.id, cat.id, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
