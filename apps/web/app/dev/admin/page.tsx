"use client";

import React, { useState } from "react";
import Link from "next/link";
import { OverviewTab } from "./overview";
import { UsersTab } from "./users";
import { OnboardingTab } from "./onboarding";
import { FeedbackTab } from "./feedback";
import { EmailTab } from "./email";
import { SettingsTab } from "./settings";
import { CancelFeedbackTab } from "./cancel-feedback";
import { ArrowLeftIcon, BarChartIcon, DoorIcon, GridIcon, MailIcon, MessageSquareIcon, RocketIcon, SettingsIcon, UsersIcon } from "./icons";

/* ── Sidebar Nav ─────────────────────────────────── */

const NAV = [
  { id: "overview", label: "Overview", icon: BarChartIcon },
  { id: "users", label: "Users", icon: UsersIcon },
  { id: "onboarding", label: "Onboarding", icon: RocketIcon },
  { id: "cancel-feedback", label: "Cancel Feedback", icon: DoorIcon },
  { id: "feedback", label: "Feedback", icon: MessageSquareIcon },
  { id: "email", label: "Email", icon: MailIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const;

type TabId = (typeof NAV)[number]["id"];

/* ── Placeholder ─────────────────────────────────── */

function PlaceholderTab({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, opacity: 0.5 }}>
      <div style={{ color: "#7c7ca3" }}>
        <GridIcon size={48} stroke="#7c7ca3" strokeWidth={1.6} />
      </div>
      <h2 style={{ margin: 0, fontSize: 20, color: "#e0e0e0" }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 13, color: "#888", maxWidth: 340, textAlign: "center", lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

/* ── Main Admin Page ─────────────────────────────── */

export default function AdminPage() {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0b0b12", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          background: "#111118",
          borderRight: "1px solid #1e1e2e",
          display: "flex",
          flexDirection: "column",
          padding: "20px 0",
          flexShrink: 0,
        }}
      >
        <Link
          href="/dev"
          style={{ padding: "0 20px 16px", fontSize: 11, color: "#555", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
        >
          <ArrowLeftIcon size={14} stroke="#666" />
          Back to Dev
        </Link>
        <div style={{ padding: "0 20px 20px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e0e0e0" }}>Admin Panel</div>
          <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>Management</div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 8px" }}>
          {NAV.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  border: "none",
                  borderRadius: 8,
                  background: active ? "#6c5ce722" : "transparent",
                  color: active ? "#a78bfa" : "#888",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <Icon size={16} stroke={active ? "#a78bfa" : "#888"} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />
        <div style={{ padding: "16px 20px", fontSize: 10, color: "#333" }}>v0.1.0 · dev</div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", padding: "28px 36px" }}>
        {tab === "overview" && <OverviewTab />}
        {tab === "users" && <UsersTab />}
        {tab === "onboarding" && <OnboardingTab />}
        {tab === "cancel-feedback" && <CancelFeedbackTab />}
        {tab === "feedback" && <FeedbackTab />}
        {tab === "email" && <EmailTab />}
        {tab === "settings" && <SettingsTab />}
      </main>
    </div>
  );
}
