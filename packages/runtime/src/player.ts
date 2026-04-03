import { Container, Graphics, Sprite, Texture, Rectangle } from "pixi.js";
import { PLAYER_SIZE, TILESET_TILE_SIZE } from "@mypixelpage/shared";
import type { AnimationDef } from "@mypixelpage/shared";

type Direction = "down" | "up" | "left" | "right" | "upRight" | "upLeft" | "downRight" | "downLeft";
type Motion = "idle" | "walk";
type ClipKey = `${Motion}_${Direction}`;

interface Clip {
  srcX: number;
  srcY: number;
  frameCount: number;
  frameDurationMs: number;
  animationId?: string;
}

interface CharacterConfig {
  tilesetSrc: string;
  frameWidthTiles: number;
  frameHeightTiles: number;
  collision: { x: number; y: number; w: number; h: number };
  zLine?: number;
  clips: Record<ClipKey, Clip>;
}

/** Map (dirX, dirY) → direction name */
function toDirection(dx: number, dy: number): Direction {
  if (dx > 0 && dy > 0) return "downRight";
  if (dx < 0 && dy > 0) return "downLeft";
  if (dx > 0 && dy < 0) return "upRight";
  if (dx < 0 && dy < 0) return "upLeft";
  if (dx > 0) return "right";
  if (dx < 0) return "left";
  if (dy < 0) return "up";
  return "down";
}

export class Player {
  x: number;
  y: number;
  size: number;
  private sprite: Sprite | Graphics;
  private config: CharacterConfig | null;
  private textures: Record<string, Texture>;
  private animationDefs: Record<string, AnimationDef>;
  private direction: Direction = "down";
  private motion: Motion = "idle";
  private animTimer = 0;
  private currentFrameIndex = -1;
  private frameTextureCache: Map<string, Texture[]> = new Map();

  constructor(
    x: number,
    y: number,
    tileSize: number,
    parent: Container,
    sizeOverride?: number,
    config?: CharacterConfig | null,
    textures?: Record<string, Texture>,
    animationDefs?: Record<string, AnimationDef>,
  ) {
    this.x = x;
    this.y = y;
    this.size = sizeOverride ?? PLAYER_SIZE;
    this.config = config ?? null;
    this.textures = textures ?? {};
    this.animationDefs = animationDefs ?? {};

    if (this.config && this.textures[this.config.tilesetSrc]) {
      // Use character sprite
      this.sprite = new Sprite();
      this.sprite.anchor.set(0.5, 0.5);
      this.sprite.width = this.config.frameWidthTiles * tileSize;
      this.sprite.height = this.config.frameHeightTiles * tileSize;
      this.updateTexture();
    } else {
      // Fallback: red rectangle
      if (this.config) {
        console.warn(
          'Player: character config found but tileset texture missing for',
          this.config.tilesetSrc,
          '— available textures:',
          Object.keys(this.textures),
        );
      } else {
        console.warn('Player: no character config in localStorage (dev-character-config)');
      }
      const g = new Graphics();
      g.roundRect(0, 0, this.size, this.size, 3);
      g.fill({ color: 0xe74c3c });
      g.circle(this.size / 2, this.size / 2 + 3, 2);
      g.fill({ color: 0xffffff });
      this.sprite = g;
    }
    this.sprite.position.set(x, y);
    if (this.sprite instanceof Graphics) {
      this.sprite.position.set(x - this.size / 2, y - this.size / 2);
    }
    parent.addChild(this.sprite);
  }

  private getClipKey(): ClipKey {
    return `${this.motion}_${this.direction}`;
  }

  private getClip(): Clip | null {
    if (!this.config) return null;
    // Try exact key, fall back to simpler direction
    let clip = this.config.clips[this.getClipKey()];
    if (!clip) {
      // Fall back: diagonal → cardinal
      const fallbacks: Record<string, Direction> = {
        downLeft: "down", downRight: "down",
        upLeft: "up", upRight: "up",
      };
      const fb = fallbacks[this.direction];
      if (fb) clip = this.config.clips[`${this.motion}_${fb}`];
    }
    if (clip) return clip;

    // Last-resort fallback: use any available clip so sprite never becomes invisible.
    const first = Object.values(this.config.clips)[0];
    return first ?? null;
  }

  private updateTexture(): void {
    if (!(this.sprite instanceof Sprite) || !this.config) return;
    const clip = this.getClip();
    if (!clip) return;

    // If clip uses an AnimationDef, use its frames
    if (clip.animationId) {
      const anim = this.animationDefs[clip.animationId];
      if (anim && anim.frames.length > 0) {
        const totalDuration = anim.frames.reduce((s, f) => s + f.durationMs, 0);
        let elapsed = anim.loop ? this.animTimer % totalDuration : Math.min(this.animTimer, totalDuration - 1);
        let frameIdx = 0;
        for (let i = 0; i < anim.frames.length; i++) {
          elapsed -= anim.frames[i]!.durationMs;
          if (elapsed < 0) { frameIdx = i; break; }
        }
        if (frameIdx === this.currentFrameIndex) return;
        this.currentFrameIndex = frameIdx;
        const frame = anim.frames[frameIdx]!;
        const base = this.textures[anim.tilesetSrc];
        if (!base) return;
        const wt = frame.widthTiles ?? this.config.frameWidthTiles;
        const ht = frame.heightTiles ?? this.config.frameHeightTiles;
        this.sprite.texture = new Texture({
          source: base.source,
          frame: new Rectangle(frame.srcX, frame.srcY, wt * TILESET_TILE_SIZE, ht * TILESET_TILE_SIZE),
        });
        return;
      }
    }

    // Manual clip: horizontal strip of frames
    const frameCount = Math.max(1, Number.isFinite(clip.frameCount) ? clip.frameCount : 1);
    const duration = Math.max(16, Number.isFinite(clip.frameDurationMs) ? clip.frameDurationMs : 120);
    const frameIdx = this.motion === "idle" && frameCount === 1
      ? 0
      : Math.floor(this.animTimer / duration) % frameCount;

    if (frameIdx === this.currentFrameIndex) return;
    this.currentFrameIndex = frameIdx;

    const cacheKey = this.getClipKey();
    let cached = this.frameTextureCache.get(cacheKey);
    if (cached && cached[frameIdx]) {
      this.sprite.texture = cached[frameIdx];
      return;
    }

    const base = this.textures[this.config.tilesetSrc];
    if (!base) return;
    const fw = this.config.frameWidthTiles * TILESET_TILE_SIZE;
    const fh = this.config.frameHeightTiles * TILESET_TILE_SIZE;
    const srcX = Number.isFinite(clip.srcX) ? clip.srcX : 0;
    const srcY = Number.isFinite(clip.srcY) ? clip.srcY : 0;
    const tex = new Texture({
      source: base.source,
      frame: new Rectangle(srcX + frameIdx * fw, srcY, fw, fh),
    });
    if (!cached) { cached = []; this.frameTextureCache.set(cacheKey, cached); }
    cached[frameIdx] = tex;
    this.sprite.texture = tex;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    if (this.sprite instanceof Sprite) {
      this.sprite.position.set(x, y);
    } else {
      this.sprite.position.set(x - this.size / 2, y - this.size / 2);
    }
  }

  setDirection(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);

    let newDir: Direction;
    if (sx !== 0 && sy !== 0) {
      // Diagonal input: keep current cardinal direction if it matches one of the pressed axes.
      // This makes the sprite use whichever direction key was pressed first.
      const hDir: Direction = sx > 0 ? "right" : "left";
      const vDir: Direction = sy > 0 ? "down" : "up";
      if (this.direction === hDir || this.direction === vDir) {
        return; // keep current direction
      }
      // Current direction doesn't match either axis (e.g. first move is diagonal) — prefer horizontal
      newDir = hDir;
    } else {
      newDir = toDirection(sx, sy);
    }

    if (newDir !== this.direction) {
      this.direction = newDir;
      this.currentFrameIndex = -1;
      this.updateTexture();
    }
  }

  setMoving(moving: boolean): void {
    const newMotion: Motion = moving ? "walk" : "idle";
    if (newMotion !== this.motion) {
      this.motion = newMotion;
      this.animTimer = 0;
      this.currentFrameIndex = -1;
      this.updateTexture();
    }
  }

  update(dt: number): void {
    this.animTimer += dt * 1000; // convert to ms
    this.updateTexture();
    // Fallback bob for Graphics placeholder
    if (this.sprite instanceof Graphics && this.motion === "walk") {
      const bob = Math.sin(this.animTimer / 100) * 1.5;
      this.sprite.position.y = this.y - this.size / 2 + bob;
    }
  }

  /** Update zIndex for Y-sort depth ordering among objects.
   *  Uses the character's zLine setting (normalized 0-1 within sprite).
   *  Defaults to sprite bottom (1.0) if not set. */
  updateZIndex(): void {
    const zLine = this.config?.zLine ?? 1;
    let spriteTop: number;
    let spriteHeight: number;
    if (this.sprite instanceof Sprite) {
      // anchor is (0.5, 0.5) → top = y - height/2
      spriteTop = this.sprite.y - this.sprite.height / 2;
      spriteHeight = this.sprite.height;
    } else {
      spriteTop = this.sprite.y;
      spriteHeight = this.size;
    }
    this.sprite.zIndex = spriteTop + spriteHeight * zLine;
  }

  getSprite(): Sprite | Graphics {
    return this.sprite;
  }
}
