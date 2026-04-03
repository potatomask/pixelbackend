"use client";

import Link from "next/link";

const CARDS = [
  {
    href: "/dev/world-editor",
    title: "World Editor",
    desc: "Tile editor, object editor, autotile, animations, categories, character, and sidepage themes.",
    icon: "🌍",
    color: "#3b82f6",
  },
  {
    href: "/dev/credit-system",
    title: "Credit System",
    desc: "Configure per-tier credit limits for each category. Controls how many items users can place.",
    icon: "💳",
    color: "#10b981",
  },
  {
    href: "/dev/admin",
    title: "Admin Panel",
    desc: "Analytics overview, user management, subscription data, feedback, and onboarding insights.",
    icon: "⚙️",
    color: "#f59e0b",
  },
  {
    href: "/dev/database",
    title: "Database Manager",
    desc: "Browse, search, and manage database tables directly. View records, edit data, and monitor your schema.",
    icon: "🗄️",
    color: "#8b5cf6",
  },
];

const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "#111118",
  color: "#e0e0e0",
  padding: "48px 40px",
  fontFamily: "system-ui, sans-serif",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const cardStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 14,
  padding: "32px 28px",
  cursor: "pointer",
  transition: "all 0.15s",
  textDecoration: "none",
  color: "#e0e0e0",
  display: "block",
  width: 320,
};

export default function DevHubPage() {
  return (
    <div style={pageBg}>
      <h1 style={{ margin: "0 0 8px", fontSize: 26 }}>Dev Tools</h1>
      <p style={{ color: "#888", fontSize: 14, marginBottom: 32 }}>Choose an editor to get started.</p>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            style={cardStyle}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = card.color;
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#333";
              (e.currentTarget as HTMLElement).style.transform = "none";
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>{card.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6, color: card.color }}>{card.title}</div>
            <div style={{ fontSize: 13, color: "#999", lineHeight: 1.5 }}>{card.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
