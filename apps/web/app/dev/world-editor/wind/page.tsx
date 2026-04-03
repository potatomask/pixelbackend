"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { WindConfig } from "@mypixelpage/shared";
import { DEFAULT_WIND_CONFIG, WIND_CONFIG_KEY } from "@mypixelpage/shared";
import { syncSettingToServer, loadSettingFromServer, autoHealSettings } from "@/lib/utils/dev-settings-sync";
import { useNotify } from "@/components/notifications";

/* ── Persistence ───────────────────────────────────── */

function loadWindConfig(): WindConfig {
  if (typeof window === "undefined") return DEFAULT_WIND_CONFIG;
  try {
    const raw = localStorage.getItem(WIND_CONFIG_KEY);
    return raw ? { ...DEFAULT_WIND_CONFIG, ...JSON.parse(raw) } : DEFAULT_WIND_CONFIG;
  } catch {
    return DEFAULT_WIND_CONFIG;
  }
}

function saveWindConfig(config: WindConfig) {
  const json = JSON.stringify(config);
  localStorage.setItem(WIND_CONFIG_KEY, json);
  syncSettingToServer(WIND_CONFIG_KEY, json);
}

/* ── Direction helpers ─────────────────────────────── */

const DIRECTION_PRESETS = [
  { label: "Right", degrees: 0, icon: "→" },
  { label: "Down-Right", degrees: 45, icon: "↘" },
  { label: "Down", degrees: 90, icon: "↓" },
  { label: "Down-Left", degrees: 135, icon: "↙" },
  { label: "Left", degrees: 180, icon: "←" },
  { label: "Up-Left", degrees: 225, icon: "↖" },
  { label: "Up", degrees: 270, icon: "↑" },
  { label: "Up-Right", degrees: 315, icon: "↗" },
];

/* ── Styles ────────────────────────────────────────── */

const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "#111118",
  color: "#e0e0e0",
  padding: "32px 40px",
  fontFamily: "system-ui, sans-serif",
};
const cardStyle: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #333",
  borderRadius: 12,
  padding: 24,
};
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#a0a0b8",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
const sliderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};
const inputRange: React.CSSProperties = { flex: 1, accentColor: "#3b82f6" };
const valueBox: React.CSSProperties = {
  minWidth: 50,
  textAlign: "right",
  fontSize: 14,
  fontFamily: "monospace",
  color: "#7dd3fc",
};

/* ── Wind Preview Canvas ─────────────────────────────── */
// True snake-chain physics: head moves, each body segment follows the one ahead.
// Mirrors the visual style of packages/runtime/src/wind.ts.

function WindPreview({ config }: { config: WindConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);

  const W = 480;
  const H = 200;

  // Number of body segments per wind line
  const SEGS = 28;

  interface ChainLine {
    // Ring-buffer of past head positions [tail ... head]
    // headPos[headIdx] = current head, headPos[headIdx-1] = where head was 1 frame ago, etc.
    headPos: { x: number; y: number }[];
    alpha: number;
    thickness: number;
    phase: number; // random phase for the wiggle
    offscreen: boolean;
  }

  // Catmull-Rom spline through chain points for smooth cartoon curves
  const catmull = (
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    t: number,
  ): { x: number; y: number } => {
    const t2 = t * t, t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
  };

  const chainsRef = useRef<ChainLine[]>([]);

  // Spawn a fresh chain at a random perpendicular offset
  const spawnChain = useCallback((perpY: number, segLen: number): ChainLine => {
    // Perpendicular spread across canvas
    const perpOff = (Math.random() - 0.5) * H * 0.85;
    // Head starts at left edge, body trails off the left
    const startX = 20 + segLen;
    const startY = H / 2 + perpY * perpOff;

    // Fill ring buffer: all positions start at spawn point
    const headPos = Array.from({ length: SEGS + 1 }, () => ({ x: startX, y: startY }));

    return {
      headPos,
      alpha: Math.max(0.05, Math.min(0.95, config.opacity * (0.65 + Math.random() * 0.7))),
      thickness: Math.max(1.0, config.size * (0.75 + Math.random() * 0.5)),
      phase: Math.random() * Math.PI * 2,
      offscreen: false,
    };
  }, [config.opacity, config.size]);

  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(draw); return; }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dt = Math.min(time - (lastTimeRef.current || time), 100);
      lastTimeRef.current = time;

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#111118";
      ctx.fillRect(0, 0, W, H);

      if (!config.enabled) {
        ctx.fillStyle = "#555";
        ctx.font = "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("Wind disabled", W / 2, H / 2);
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const rad = (config.direction * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      const perpX = -dy;
      const perpY = dx;
      const rgb = hexToRgb(config.color);

      const segLen = Math.max(6, (config.length || 80) / SEGS);
      const fadePx = Math.max(0, config.fade);
      const speed = Math.max(12, config.speed * (0.72 + Math.random() * 0.7));
      const curveAmt = Math.max(0, Math.min(1, (config.curve ?? 40) / 100));
      // Wiggle amplitude perpendicular to wind direction
      const wiggleAmp = (config.length || 80) * 0.14 * curveAmt;
      const wiggleFreq = 1.6 + curveAmt * 2.0;

      const headIdx = SEGS;

      // Maintain correct chain count
      const chains = chainsRef.current;
      while (chains.length < config.density) {
        chains.push(spawnChain(perpY, segLen));
      }
      while (chains.length > config.density) chains.pop();

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const chain of chains) {
        if (chain.offscreen) {
          // Tiny chance to respawn
          if (Math.random() < 0.003) {
            const newChain = spawnChain(perpY, segLen);
            chain.headPos = newChain.headPos;
            chain.alpha = newChain.alpha;
            chain.thickness = newChain.thickness;
            chain.phase = newChain.phase;
            chain.offscreen = false;
          }
          continue;
        }

        // ── Snake physics: advance head, body follows ─────────────
        const head = chain.headPos[headIdx]!;

        // Head moves in wind direction + perpendicular wiggle
        const wigglePhase = (time / 1000) * wiggleFreq + chain.phase;
        const wiggle = Math.sin(wigglePhase) * wiggleAmp;

        const newHx = head.x + dx * speed * (dt / 1000) + perpX * wiggle;
        const newHy = head.y + dy * speed * (dt / 1000) + perpY * wiggle;

        // Push new head position: shift ring buffer [0..headIdx-1] = [1..headIdx]
        for (let i = 0; i < headIdx; i++) {
          chain.headPos[i] = chain.headPos[i + 1]!;
        }
        chain.headPos[headIdx] = { x: newHx, y: newHy };

        // Check if entire chain has scrolled off screen (using oldest/tail position)
        const tail = chain.headPos[0]!;
        if (
          tail.x < -W * 1.5 || tail.x > W * 2.5 ||
          tail.y < -H * 1.5 || tail.y > H * 2.5
        ) {
          chain.offscreen = true;
          continue;
        }

        // ── Draw smooth spline through chain body ───────────────
        // Collect spline points with per-point alpha
        const SUB = 5; // Catmull-Rom subdivisions per segment
        const pts: { x: number; y: number; alpha: number }[] = [];

        for (let i = 0; i < headIdx; i++) {
          const p0i = Math.max(0, i - 1);
          const p1i = i;
          const p2i = Math.min(headIdx, i + 1);
          const p3i = Math.min(headIdx, i + 2);

          for (let s = 0; s < SUB; s++) {
            const t = s / SUB;
            const pt = catmull(
              chain.headPos[p0i]!,
              chain.headPos[p1i]!,
              chain.headPos[p2i]!,
              chain.headPos[p3i]!,
              t,
            );
            // chainT: 0 = tail (oldest), 1 = head (newest)
            const chainT = (i + t) / headIdx;
            // Fade in from tail, fade out at head
            const fadeFrac = fadePx > 0 ? Math.min(0.45, fadePx / Math.max(1, config.length || 80)) : 0.45;
            const tailFade = Math.min(1, chainT / Math.max(0.001, fadeFrac));
            const headFade = Math.min(1, (1 - chainT) / Math.max(0.001, fadeFrac));
            const alpha = chain.alpha * tailFade * headFade;
            pts.push({ x: pt.x, y: pt.y, alpha });
          }
        }

        // Draw solid line with per-segment alpha — no round dots
        ctx.lineWidth = chain.thickness;
        ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(0.5, chain.alpha * 0.45)})`;
        ctx.shadowBlur = chain.thickness * 1.8;

        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i]!;
          const p1 = pts[i + 1]!;
          if (p0.alpha < 0.005 && p1.alpha < 0.005) continue;
          const midAlpha = (p0.alpha + p1.alpha) / 2;
          ctx.globalAlpha = Math.max(0, Math.min(1, midAlpha));
          ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(draw);
    },
    [config, SEGS, spawnChain],
  );

  useEffect(() => {
    chainsRef.current = [];
    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: "100%", maxWidth: W, height: H, borderRadius: 8, border: "1px solid #333" }}
    />
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0]! + cleaned[0]!, 16),
      g: parseInt(cleaned[1]! + cleaned[1]!, 16),
      b: parseInt(cleaned[2]! + cleaned[2]!, 16),
    };
  }
  const full = cleaned.padEnd(6, "f").slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/* ── Page Component ────────────────────────────────── */

export default function WindSettingsPage() {
  const [config, setConfig] = useState<WindConfig>(DEFAULT_WIND_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const { confirm } = useNotify();

  useEffect(() => {
    loadSettingFromServer(WIND_CONFIG_KEY).then((serverVal) => {
      setConfig(loadWindConfig());
      setLoaded(true);
      autoHealSettings([[WIND_CONFIG_KEY, serverVal]]);
    });
  }, []);

  const update = (patch: Partial<WindConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveWindConfig(next);
  };

  const resetDefaults = () => {
    confirm("Reset wind settings to defaults?", () => {
      setConfig(DEFAULT_WIND_CONFIG);
      saveWindConfig(DEFAULT_WIND_CONFIG);
    }, { title: "Reset Wind", confirmText: "Reset", cancelText: "Cancel" });
  };

  if (!loaded) {
    return <div style={pageBg}><p style={{ color: "#888" }}>Loading…</p></div>;
  }

  return (
    <div style={pageBg}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <a href="/dev/world-editor" style={{ color: "#888", textDecoration: "none", fontSize: 14, padding: "6px 14px", border: "1px solid #333", borderRadius: 8, background: "#1a1a2e" }}>← Back</a>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>🌬️ Wind Settings</h1>
          <p style={{ margin: "4px 0 0", color: "#888", fontSize: 14 }}>Global wind effect — applies to all worlds.</p>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Live Preview</h2>
        <WindPreview key={JSON.stringify(config)} config={config} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 900 }}>
        <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={config.enabled} onChange={(e) => update({ enabled: e.target.checked })} style={{ width: 20, height: 20, accentColor: "#3b82f6" }} />
            <span style={{ fontSize: 16, fontWeight: 700 }}>Enable Wind Effect</span>
          </label>
        </div>

        <div style={cardStyle}><label style={labelStyle}>Density (line count)</label><div style={sliderRow}><input type="range" min={1} max={100} step={1} value={config.density} onChange={(e) => update({ density: Number(e.target.value) })} style={inputRange} /><span style={valueBox}>{config.density}</span></div></div>
        <div style={cardStyle}><label style={labelStyle}>Thickness (px)</label><div style={sliderRow}><input type="range" min={0.5} max={6} step={0.5} value={config.size} onChange={(e) => update({ size: Number(e.target.value) })} style={inputRange} /><span style={valueBox}>{config.size}</span></div></div>
        <div style={cardStyle}><label style={labelStyle}>Length (px)</label><div style={sliderRow}><input type="range" min={20} max={300} step={5} value={config.length} onChange={(e) => update({ length: Number(e.target.value) })} style={inputRange} /><span style={valueBox}>{config.length}</span></div></div>
        <div style={cardStyle}><label style={labelStyle}>Fade (px at each end)</label><div style={sliderRow}><input type="range" min={0} max={150} step={5} value={config.fade} onChange={(e) => update({ fade: Number(e.target.value) })} style={inputRange} /><span style={valueBox}>{config.fade}</span></div></div>
        <div style={cardStyle}><label style={labelStyle}>Opacity</label><div style={sliderRow}><input type="range" min={0.01} max={0.6} step={0.01} value={config.opacity} onChange={(e) => update({ opacity: Number(e.target.value) })} style={inputRange} /><span style={valueBox}>{config.opacity.toFixed(2)}</span></div></div>
        <div style={cardStyle}><label style={labelStyle}>Speed (px/sec)</label><div style={sliderRow}><input type="range" min={20} max={500} step={10} value={config.speed} onChange={(e) => update({ speed: Number(e.target.value) })} style={inputRange} /><span style={valueBox}>{config.speed}</span></div></div>
        <div style={cardStyle}><label style={labelStyle}>Curve (0 = straight, 100 = max swirl)</label><div style={sliderRow}><input type="range" min={0} max={100} step={1} value={config.curve ?? 40} onChange={(e) => update({ curve: Number(e.target.value) })} style={inputRange} /><span style={valueBox}>{config.curve ?? 40}</span></div></div>

        <div style={cardStyle}>
          <label style={labelStyle}>Color</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input type="color" value={config.color} onChange={(e) => update({ color: e.target.value })} style={{ width: 40, height: 32, border: "1px solid #555", borderRadius: 6, cursor: "pointer", background: "transparent" }} />
            <span style={{ fontFamily: "monospace", fontSize: 14, color: "#7dd3fc" }}>{config.color}</span>
          </div>
        </div>

        <div style={{ ...cardStyle, gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Direction</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {DIRECTION_PRESETS.map((p) => (
              <button key={p.degrees} onClick={() => update({ direction: p.degrees })} style={{ padding: "6px 14px", borderRadius: 8, border: config.direction === p.degrees ? "2px solid #3b82f6" : "1px solid #444", background: config.direction === p.degrees ? "#1e3a5f" : "#222", color: config.direction === p.degrees ? "#7dd3fc" : "#aaa", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s" }}>{p.icon} {p.label}</button>
            ))}
          </div>
          <div style={sliderRow}><span style={{ fontSize: 12, color: "#888" }}>Fine-tune:</span><input type="range" min={0} max={359} step={1} value={config.direction} onChange={(e) => update({ direction: Number(e.target.value) })} style={inputRange} /><span style={valueBox}>{config.direction}°</span></div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button onClick={resetDefaults} style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #555", background: "#222", color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Reset to Defaults</button>
      </div>
    </div>
  );
}
