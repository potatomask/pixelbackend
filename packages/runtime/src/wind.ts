import { Container, Sprite, Texture, ImageSource } from "pixi.js";
import type { WindConfig } from "@mypixelpage/shared";
import { DEFAULT_WIND_CONFIG } from "@mypixelpage/shared";

interface WindLine {
  /** Current progress along the line's travel path (px from spawn point). */
  progress: number;
  /** Total distance the line travels before respawning. */
  travelDistance: number;
  /** World X of the spawn origin. */
  originX: number;
  /** World Y of the spawn origin. */
  originY: number;
  /** Per-line randomized visual parameters for more organic motion. */
  length: number;
  thickness: number;
  speed: number;
  curveAmplitude: number;
  curveFrequency: number;
  swirlSpeed: number;
  phase: number;
  alpha: number;
  jitter: number;
  segments: Sprite[];
}

/**
 * Draws cartoon-style wind streaks on a PixiJS Container.
 * Each streak is rendered with smooth gradient sprites, then bent/swirled
 * over time for organic, non-linear motion.
 */
export class WindOverlay {
  private container: Container;
  private segmentTexture: Texture;
  private config: WindConfig;
  private lines: WindLine[] = [];
  /** Cached direction unit vector. */
  private dirX = 1;
  private dirY = 0;
  private perpX = 0;
  private perpY = 1;
  /** Viewport-aware spawn area (padded beyond screen). */
  private areaWidth = 1920;
  private areaHeight = 1080;
  private timeMs = 0;
  private readonly segmentsPerLine = 10;

  constructor(parent: Container, config?: WindConfig) {
    this.config = config ?? DEFAULT_WIND_CONFIG;
    this.container = new Container();
    this.container.label = "wind-overlay";
    // Wind renders above tiles/objects but below UI.
    // Use a high zIndex; callers can adjust if needed.
    this.container.zIndex = 9000;
    parent.addChild(this.container);

    this.segmentTexture = createWindSegmentTexture();

    this.updateDirection();
    this.spawnLines();
  }

  /** Replace the full config (e.g. on hot reload from settings). */
  setConfig(config: WindConfig): void {
    this.config = config;
    this.updateDirection();
    this.container.visible = config.enabled;
    this.spawnLines();
  }

  private updateDirection(): void {
    const rad = (this.config.direction * Math.PI) / 180;
    this.dirX = Math.cos(rad);
    this.dirY = Math.sin(rad);
    this.perpX = -this.dirY;
    this.perpY = this.dirX;
  }

  /** Initialize (or re-initialize) all wind line particles. */
  private spawnLines(): void {
    const count = Math.max(0, Math.min(140, this.config.density));

    // Grow
    while (this.lines.length < count) {
      this.lines.push(this.createLine(true));
    }

    // Shrink
    while (this.lines.length > count) {
      const line = this.lines.pop();
      for (const seg of line?.segments ?? []) {
        seg.destroy();
      }
    }

    // Re-randomize existing lines so changes feel immediate
    for (const line of this.lines) {
      this.reseedLine(line, true);
    }
  }

  /** Create a single wind line with randomised origin. randomProgress=true scatters initial positions. */
  private createLine(randomProgress: boolean): WindLine {
    const segments: Sprite[] = [];
    for (let i = 0; i < this.segmentsPerLine; i++) {
      const sprite = new Sprite(this.segmentTexture);
      sprite.anchor.set(0.5);
      this.container.addChild(sprite);
      segments.push(sprite);
    }

    const line: WindLine = {
      progress: 0,
      travelDistance: 1,
      originX: 0,
      originY: 0,
      length: 1,
      thickness: 1,
      speed: 1,
      curveAmplitude: 1,
      curveFrequency: 1,
      swirlSpeed: 1,
      phase: 0,
      alpha: 0.2,
      jitter: 1,
      segments,
    };
    this.reseedLine(line, randomProgress);
    return line;
  }

  private reseedLine(line: WindLine, randomProgress: boolean): void {
    const r = Math.random;
    const lengthBase = Math.max(8, this.config.length);
    const speedBase = Math.max(1, this.config.speed);
    const thicknessBase = Math.max(0.2, this.config.size);

    line.length = clamp(lengthBase * (0.68 + r() * 0.9), 16, 520);
    line.thickness = clamp(thicknessBase * (0.8 + r() * 0.85), 0.4, 12);
    line.speed = clamp(speedBase * (0.72 + r() * 0.7), 12, 800);
    const curveFactor = clamp((this.config.curve ?? 40) / 100, 0, 1);
    line.curveAmplitude = Math.max(0.5, line.length * (0.08 + r() * 0.2) * curveFactor);
    line.curveFrequency = 0.8 + r() * 1.6;
    line.swirlSpeed = (0.7 + r() * 2.4) * curveFactor;
    line.phase = r() * Math.PI * 2;
    line.alpha = clamp(this.config.opacity * (0.65 + r() * 0.7), 0.02, 0.95);
    line.jitter = 0.6 + r() * 2.2;

    const spread = Math.max(this.areaWidth, this.areaHeight) * 1.55;
    const perpOffset = (r() - 0.5) * spread;
    const backOffset = -(line.length + this.areaWidth * (0.35 + r() * 0.15));
    const centerX = this.areaWidth / 2;
    const centerY = this.areaHeight / 2;

    line.originX = centerX + this.dirX * backOffset + this.perpX * perpOffset;
    line.originY = centerY + this.dirY * backOffset + this.perpY * perpOffset;

    line.travelDistance = line.length + this.areaWidth * (0.8 + r() * 0.9);
    line.progress = randomProgress ? r() * line.travelDistance : 0;

    const tint = parseHexColor(this.config.color);
    for (const seg of line.segments) {
      seg.tint = tint;
    }
  }

  private samplePoint(line: WindLine, t: number, viewport: { minX: number; minY: number }): { x: number; y: number } {
    const headDist = line.progress;
    const tailOffset = (1 - t) * line.length;
    const forward = headDist - tailOffset;

    const baseX = viewport.minX + line.originX + this.dirX * forward;
    const baseY = viewport.minY + line.originY + this.dirY * forward;

    const time = this.timeMs / 1000;
    const curvePhase = t * line.curveFrequency * Math.PI * 2 + line.phase + time * line.swirlSpeed;
    const curve = Math.sin(curvePhase) * line.curveAmplitude;
    const wobble = Math.sin(time * (2.5 + line.jitter) + t * 14.0 + line.phase * 0.5) * line.curveAmplitude * 0.13;

    return {
      x: baseX + this.perpX * (curve + wobble),
      y: baseY + this.perpY * (curve + wobble),
    };
  }

  /**
   * Update & draw wind lines. Call once per frame.
   * @param deltaMs Frame delta in milliseconds.
   * @param viewport Current camera viewport in world coords (for positioning the overlay).
   */
  update(deltaMs: number, viewport: { minX: number; minY: number; maxX: number; maxY: number }): void {
    if (!this.config.enabled || this.lines.length === 0) {
      this.container.visible = false;
      return;
    }

    this.container.visible = true;
    this.timeMs += deltaMs;

    // Track the visible area size so spawns are proportional
    this.areaWidth = viewport.maxX - viewport.minX;
    this.areaHeight = viewport.maxY - viewport.minY;

    const deltaSec = deltaMs / 1000;
    const fadePx = Math.max(0, this.config.fade);
    const texW = Math.max(1, this.segmentTexture.width);
    const texH = Math.max(1, this.segmentTexture.height);

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i]!;
      line.progress += line.speed * deltaSec;

      // Respawn if past travel distance
      if (line.progress >= line.travelDistance) {
        this.reseedLine(line, false);
      }

      const segLength = line.length / this.segmentsPerLine;
      const scaleX = (segLength * 1.35) / texW;
      const scaleY = line.thickness / texH;

      for (let s = 0; s < line.segments.length; s++) {
        const seg = line.segments[s]!;
        const t = (s + 0.5) / line.segments.length;
        const p = this.samplePoint(line, t, viewport);
        const pPrev = this.samplePoint(line, Math.max(0, t - 0.08), viewport);
        const pNext = this.samplePoint(line, Math.min(1, t + 0.08), viewport);

        const angle = Math.atan2(pNext.y - pPrev.y, pNext.x - pPrev.x);
        seg.position.set(p.x, p.y);
        seg.rotation = angle;
        seg.scale.set(scaleX, scaleY);

        const distFromTail = t * line.length;
        const distFromHead = (1 - t) * line.length;
        const fadeTail = fadePx > 0 ? clamp(distFromTail / fadePx, 0, 1) : 1;
        const fadeHead = fadePx > 0 ? clamp(distFromHead / fadePx, 0, 1) : 1;
        const midBoost = Math.pow(Math.sin(t * Math.PI), 0.85);
        seg.alpha = clamp(line.alpha * fadeTail * fadeHead * midBoost, 0, 1);
      }
    }
  }

  destroy(): void {
    for (const line of this.lines) {
      for (const seg of line.segments) seg.destroy();
    }
    this.lines = [];
    this.segmentTexture.destroy(true);
    this.container.destroy({ children: true });
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function createWindSegmentTexture(): Texture {
  const w = 96;
  const h = 20;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Texture.WHITE;

  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.18, "rgba(255,255,255,0.92)");
  grad.addColorStop(0.5, "rgba(255,255,255,1)");
  grad.addColorStop(0.82, "rgba(255,255,255,0.92)");
  grad.addColorStop(1, "rgba(255,255,255,0)");

  const vGrad = ctx.createLinearGradient(0, 0, 0, h);
  vGrad.addColorStop(0, "rgba(255,255,255,0)");
  vGrad.addColorStop(0.5, "rgba(255,255,255,1)");
  vGrad.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  const source = new ImageSource({ resource: canvas, scaleMode: "linear" });
  return new Texture({ source });
}

/** Parse "#rrggbb" or "#rgb" to a numeric color value. */
function parseHexColor(hex: string): number {
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0]! + cleaned[0]!, 16);
    const g = parseInt(cleaned[1]! + cleaned[1]!, 16);
    const b = parseInt(cleaned[2]! + cleaned[2]!, 16);
    return (r << 16) | (g << 8) | b;
  }
  return parseInt(cleaned.slice(0, 6), 16) || 0xffffff;
}
