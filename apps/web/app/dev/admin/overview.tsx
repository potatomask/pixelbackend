"use client";

import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { BarChartIcon, GlobeIcon, SparklesIcon, TrendingUpIcon, UsersIcon } from "./icons";

/* ── Types ────────────────────────────────────────── */

interface StatsData {
  totalUsers: number;
  tiers: Record<string, number>;
  totalWorlds: number;
  publishedWorlds: number;
  dailySignups: { date: string; count: number; free: number; starter: number; pro: number; tester: number }[];
  latestUsers: { handle: string; tier: string; createdAt: string }[];
  paidUsers: number;
  newUsersThisMonth: number;
}

/* ── Palette ──────────────────────────────────────── */

const P = {
  card: "#13131f",
  cardBorder: "#1e1e2e",
  bg: "#0b0b12",
  accent: "#6c5ce7",
  accentSoft: "#6c5ce722",
  green: "#00cec9",
  greenSoft: "#00cec916",
  orange: "#fdcb6e",
  orangeSoft: "#fdcb6e16",
  rose: "#fd79a8",
  roseSoft: "#fd79a816",
  text: "#e0e0e0",
  textDim: "#999",
  textMuted: "#555",
  free: "#6b7280",
  starter: "#6c5ce7",
  pro: "#fdcb6e",
  tester: "#22c55e",
};

/* ── Stat Card ────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  delta,
  color,
  bgTint,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delta?: string;
  color: string;
  bgTint: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: P.card,
        border: `1px solid ${P.cardBorder}`,
        borderRadius: 14,
        padding: "20px 22px",
        flex: "1 1 200px",
        minWidth: 180,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -8,
          right: -8,
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: bgTint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
        }}
      >
        {icon}
      </div>

      <div style={{ fontSize: 11, color: P.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: P.text }}>{value}</div>
        {delta && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color,
              background: bgTint,
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            {delta}
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11, color: P.textMuted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ── Mini card for tier breakdown ─────────────────── */

function TierBadge({ tier, count, color }: { tier: string; count: number; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: color + "11",
        border: `1px solid ${color}33`,
        borderRadius: 8,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 12, color: P.textDim }}>{tier}</span>
      <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 700, color: P.text }}>{count}</span>
    </div>
  );
}

/* ── Custom Tooltip ───────────────────────────────── */

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#1a1a2e",
        border: "1px solid #2a2a3e",
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontSize: 11, color: P.textDim, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: P.text }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
          <span style={{ color: P.textDim }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Overview Component ───────────────────────────── */

export function OverviewTab() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: P.textMuted }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, animation: "pulse 1.5s ease-in-out infinite" }}>
            <BarChartIcon size={32} stroke="#8f84ff" strokeWidth={1.7} />
          </div>
          <div style={{ fontSize: 13 }}>Loading analytics...</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return <div style={{ color: P.textDim, textAlign: "center", marginTop: 80, fontSize: 14 }}>Failed to load stats</div>;
  }

  const pieData = [
    { name: "Free", value: stats.tiers.FREE ?? 0, color: P.free },
    { name: "Starter", value: stats.tiers.STARTER ?? 0, color: P.starter },
    { name: "Pro", value: stats.tiers.PRO ?? 0, color: P.pro },
    { name: "Tester", value: stats.tiers.TESTER ?? 0, color: P.tester },
  ].filter((d) => d.value > 0);

  const conversionRate = stats.totalUsers > 0 ? ((stats.paidUsers / stats.totalUsers) * 100).toFixed(1) : "0";

  // Format daily signups for nicer X axis
  const chartData = stats.dailySignups.map((d) => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" }),
  }));

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: P.text }}>Analytics Overview</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: P.textDim }}>
          Your platform at a glance. Data refreshed on each load.
        </p>
      </div>

      {/* Stat Cards Row */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <StatCard label="Total Users" value={stats.totalUsers} icon={<UsersIcon size={24} stroke={P.accent} />} color={P.accent} bgTint={P.accentSoft} sub="All registered accounts" />
        <StatCard label="Paid Users" value={stats.paidUsers} icon={<SparklesIcon size={24} stroke={P.green} />} color={P.green} bgTint={P.greenSoft} delta={`${conversionRate}%`} sub="Starter + Pro" />
        <StatCard label="Total Worlds" value={stats.totalWorlds} icon={<GlobeIcon size={24} stroke={P.orange} />} color={P.orange} bgTint={P.orangeSoft} sub={`${stats.publishedWorlds} published`} />
        <StatCard
          label="New This Month"
          value={stats.newUsersThisMonth}
          icon={<TrendingUpIcon size={24} stroke={P.rose} />}
          color={P.rose}
          bgTint={P.roseSoft}
          sub="Last 30 days"
        />
      </div>

      {/* Main chart row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        {/* Growth chart - large */}
        <div
          style={{
            flex: "2 1 500px",
            background: P.card,
            border: `1px solid ${P.cardBorder}`,
            borderRadius: 14,
            padding: "22px 24px",
            minHeight: 340,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: P.text }}>User Growth</div>
              <div style={{ fontSize: 11, color: P.textDim, marginTop: 2 }}>Daily signups over the last 30 days</div>
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: P.accent, display: "inline-block" }} />
                <span style={{ color: P.textDim }}>Signups</span>
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={P.accent} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={P.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: P.textMuted }}
                axisLine={{ stroke: "#1e1e2e" }}
                tickLine={false}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: P.textMuted }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                name="Signups"
                stroke={P.accent}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorSignups)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tier distribution - small */}
        <div
          style={{
            flex: "1 1 260px",
            background: P.card,
            border: `1px solid ${P.cardBorder}`,
            borderRadius: 14,
            padding: "22px 24px",
            minHeight: 340,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: P.text, marginBottom: 4 }}>Tier Distribution</div>
          <div style={{ fontSize: 11, color: P.textDim, marginBottom: 16 }}>Active user breakdown</div>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]!;
                    return (
                      <div style={{ background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: P.text }}>
                        <span style={{ fontWeight: 600 }}>{d.name}:</span> {d.value}
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            <TierBadge tier="Free" count={stats.tiers.FREE ?? 0} color={P.free} />
            <TierBadge tier="Starter" count={stats.tiers.STARTER ?? 0} color={P.starter} />
            <TierBadge tier="Pro" count={stats.tiers.PRO ?? 0} color={P.pro} />
            <TierBadge tier="Tester" count={stats.tiers.TESTER ?? 0} color={P.tester} />
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* Tier bar chart */}
        <div
          style={{
            flex: "1 1 360px",
            background: P.card,
            border: `1px solid ${P.cardBorder}`,
            borderRadius: 14,
            padding: "22px 24px",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: P.text, marginBottom: 4 }}>Signups by Tier</div>
          <div style={{ fontSize: 11, color: P.textDim, marginBottom: 16 }}>Last 30 days, stacked</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: P.textMuted }}
                axisLine={{ stroke: "#1e1e2e" }}
                tickLine={false}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis tick={{ fontSize: 10, fill: P.textMuted }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="free" name="Free" stackId="a" fill={P.free} radius={[0, 0, 0, 0]} />
              <Bar dataKey="starter" name="Starter" stackId="a" fill={P.starter} />
              <Bar dataKey="pro" name="Pro" stackId="a" fill={P.pro} />
              <Bar dataKey="tester" name="Tester" stackId="a" fill={P.tester} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity */}
        <div
          style={{
            flex: "1 1 300px",
            background: P.card,
            border: `1px solid ${P.cardBorder}`,
            borderRadius: 14,
            padding: "22px 24px",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: P.text, marginBottom: 4 }}>Recent Signups</div>
          <div style={{ fontSize: 11, color: P.textDim, marginBottom: 16 }}>Latest users to join</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stats.latestUsers.map((u, i) => {
              const tierColor = u.tier === "TESTER"
                ? P.tester
                : u.tier === "PRO"
                  ? P.pro
                  : u.tier === "STARTER"
                    ? P.starter
                    : P.free;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    background: "#0b0b12",
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: `linear-gradient(135deg, ${tierColor}44, ${tierColor}22)`,
                      border: `1px solid ${tierColor}44`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: tierColor,
                    }}
                  >
                    {u.handle.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: P.text }}>/{u.handle}</div>
                    <div style={{ fontSize: 10, color: P.textMuted }}>
                      {new Date(u.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: tierColor + "22",
                      color: tierColor,
                      border: `1px solid ${tierColor}33`,
                    }}
                  >
                    {u.tier}
                  </span>
                </div>
              );
            })}

            {stats.latestUsers.length === 0 && (
              <div style={{ textAlign: "center", padding: 20, color: P.textMuted, fontSize: 12 }}>No users yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
