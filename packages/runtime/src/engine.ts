import { Application, Container, Assets, Texture, ImageSource } from "pixi.js";
import type { WorldData, WorldAssets, ObjectDef, AnimationDef, CustomObjectPayload } from "@mypixelpage/shared";
import { PLAYER_SPEED, DEFAULT_TILE_SIZE, initDevTiles, registerDevTiles } from "@mypixelpage/shared";
import { getUniqueTilesetSources, setCenterVariants, setCustomLinearMap } from "@mypixelpage/shared";
import { loadWindConfig } from "@mypixelpage/shared";
import type { WindConfig } from "@mypixelpage/shared";
import { TileRenderer } from "./renderer";
import { WindOverlay } from "./wind";
import { Player } from "./player";
import { Camera } from "./camera";
import { CollisionMap } from "./collision";
import { InteractionManager } from "./interaction";
import { InputManager } from "./input";

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  worldData: WorldData;
  tileSize?: number;
  showSpawnMarker?: boolean;
  onInteraction?: (objectId: string) => void;
  onInteractionProximity?: (objectId: string | null) => void;
  onMouseHover?: (objectId: string | null) => void;
  onAfterFrame?: () => void;
  onError?: (error: unknown) => void;
}

export class Engine {
  app!: Application;
  worldContainer!: Container;
  tileRenderer!: TileRenderer;
  windOverlay!: WindOverlay;
  player!: Player;
  camera!: Camera;
  collisionMap!: CollisionMap;
  interactionManager!: InteractionManager;
  inputManager!: InputManager;

  private worldData: WorldData;
  private tileSize: number;
  private onInteraction?: (objectId: string) => void;
  private onInteractionProximity?: (objectId: string | null) => void;
  private onMouseHover?: (objectId: string | null) => void;
  private onAfterFrame?: () => void;
  private onError?: (error: unknown) => void;
  private canvas: HTMLCanvasElement;
  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private renderErrors = 0;
  private isDestroyed = false;
  private contextLost = false;
  private tilesetTextures: Record<string, Texture> = {};
  private showSpawnMarker: boolean;
  private mouseHoveredObjectId: string | null = null;
  private canvasMouseMoveHandler: ((e: MouseEvent) => void) | null = null;
  private stagePointerMoveHandler: ((e: unknown) => void) | null = null;
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (!this.camera) return;
    if (e.deltaY < 0) {
      this.camera.zoomIn();
    } else {
      this.camera.zoomOut();
    }
  };

  private getCustomObjectDefs(): Record<string, ObjectDef> {
    const merged: Record<string, ObjectDef> = {};
    // Start with bundled assets
    if (this.worldData.assets?.objects?.length) {
      Object.assign(merged, Object.fromEntries(this.worldData.assets.objects.map((obj) => [obj.id, obj])));
    }
    if (typeof window === "undefined") return merged;
    try {
      const raw = JSON.parse(localStorage.getItem("dev-objects") ?? "[]") as unknown[];
      const defs = raw.filter((obj): obj is ObjectDef => {
        return (
          !!obj &&
          typeof obj === "object" &&
          typeof (obj as { id?: unknown }).id === "string"
        );
      });
      // Local defs override bundled defs while editing.
      Object.assign(merged, Object.fromEntries(defs.map((obj) => [obj.id, obj])));
      return merged;
    } catch {
      return merged;
    }
  }

  private getCustomObjectTextureSources(worldData: WorldData): string[] {
    const defs = this.getCustomObjectDefs();
    const animations = this.getAnimationDefs();
    const sources = new Set<string>();
    for (const obj of worldData.objects) {
      if (obj.type !== "custom" || obj.payload.kind !== "custom") continue;
      const def = defs[obj.payload.objectDefId];
      if (def?.tilesetSrc) sources.add(def.tilesetSrc);
      for (const variation of def?.variations ?? []) {
        if (variation.tilesetSrc) sources.add(variation.tilesetSrc);
      }
      if (def?.animationId && animations[def.animationId]?.tilesetSrc) {
        sources.add(animations[def.animationId]!.tilesetSrc);
      }
    }
    return Array.from(sources);
  }

  private sanitizeTextureSources(sources: unknown[]): string[] {
    return sources.filter((src): src is string => {
      if (typeof src !== "string") return false;
      const trimmed = src.trim();
      return trimmed.length > 0;
    });
  }

  /**
   * Load a texture from a URL or data URL.
   * Data URLs bypass PixiJS Assets (which can choke after Assets.reset()).
   * For regular URLs, tries Assets first, then falls back to Image element.
   */
  private async loadTexture(src: string): Promise<Texture | null> {
    // Data URLs: always use Image element directly
    if (src.startsWith('data:')) {
      return this.loadTextureViaImage(src);
    }
    // Regular URL: try PixiJS Assets first
    try {
      const tex = await Assets.load<Texture>(src);
      tex.source.scaleMode = 'nearest';
      if (tex.source.width > 0 && tex.source.height > 0) {
        return tex;
      }
    } catch {
      // Assets.load failed — try Image fallback
    }
    // Fallback: load via Image element
    return this.loadTextureViaImage(src);
  }

  private loadTextureViaImage(src: string): Promise<Texture | null> {
    return new Promise<Texture | null>((resolve) => {
      const img = new globalThis.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const source = new ImageSource({ resource: img, scaleMode: 'nearest' });
          resolve(new Texture({ source }));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  private getAnimationDefs(): Record<string, AnimationDef> {
    const merged: Record<string, AnimationDef> = {};
    // Start with bundled assets
    if (this.worldData.assets?.animations?.length) {
      Object.assign(merged, Object.fromEntries(this.worldData.assets.animations.map((anim) => [anim.id, anim])));
    }
    if (typeof window === "undefined") return merged;
    try {
      const raw = JSON.parse(localStorage.getItem("dev-animations") ?? "[]") as unknown[];
      const defs = raw.filter((anim): anim is AnimationDef => {
        return (
          !!anim &&
          typeof anim === "object" &&
          typeof (anim as { id?: unknown }).id === "string" &&
          typeof (anim as { tilesetSrc?: unknown }).tilesetSrc === "string"
        );
      });
      // Local defs override bundled defs while editing.
      Object.assign(merged, Object.fromEntries(defs.map((anim) => [anim.id, anim])));
      return merged;
    } catch {
      return merged;
    }
  }

  private getCharacterCollisionSize(): number {
    // Prefer local config while editing, then fall back to bundled config.
    let bundled = this.worldData.assets?.characterConfig;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("dev-character-config");
        if (raw) bundled = JSON.parse(raw) as NonNullable<typeof bundled>;
      } catch {
        // ignore parse errors and keep bundled fallback
      }
    }
    if (bundled) {
      const fw = Math.max(1, bundled.frameWidthTiles ?? 1);
      const fh = Math.max(1, bundled.frameHeightTiles ?? 1);
      const w = Math.max(0.1, Math.min(1, bundled.collision?.w ?? 0.75));
      const h = Math.max(0.1, Math.min(1, bundled.collision?.h ?? 0.75));
      const collisionW = w * fw * this.tileSize;
      const collisionH = h * fh * this.tileSize;
      return Math.max(4, Math.min(collisionW, collisionH));
    }
    if (typeof window === "undefined") return this.tileSize * 0.75;
    try {
      const raw = localStorage.getItem("dev-character-config");
      if (!raw) return this.tileSize * 0.75;
      const parsed = JSON.parse(raw) as {
        frameWidthTiles?: number;
        frameHeightTiles?: number;
        collision?: { w?: number; h?: number };
      };
      const fw = Math.max(1, parsed.frameWidthTiles ?? 1);
      const fh = Math.max(1, parsed.frameHeightTiles ?? 1);
      const w = Math.max(0.1, Math.min(1, parsed.collision?.w ?? 0.75));
      const h = Math.max(0.1, Math.min(1, parsed.collision?.h ?? 0.75));
      const collisionW = w * fw * this.tileSize;
      const collisionH = h * fh * this.tileSize;
      return Math.max(4, Math.min(collisionW, collisionH));
    } catch {
      return this.tileSize * 0.75;
    }
  }

  private getCharacterConfig(): Record<string, unknown> | null {
    // Prefer local config while editing, then fall back to bundled config.
    let bundled = this.worldData.assets?.characterConfig;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("dev-character-config");
        if (raw) bundled = JSON.parse(raw) as NonNullable<typeof bundled>;
      } catch {
        // ignore parse errors and keep bundled fallback
      }
    }
    if (bundled) {
      const config = { ...bundled } as Record<string, unknown>;
      if (!config.tilesetSrc || typeof config.tilesetSrc !== "string") {
        config.tilesetSrc = "/tilesets/characters.png";
      }
      if (typeof config.frameWidthTiles !== "number" || (config.frameWidthTiles as number) < 1) {
        config.frameWidthTiles = 3;
      }
      if (typeof config.frameHeightTiles !== "number" || (config.frameHeightTiles as number) < 1) {
        config.frameHeightTiles = 3;
      }
      if (typeof config.zLine !== "number") {
        config.zLine = 0.95;
      }
      return config;
    }
    return null;
  }

  /** Compute player spawn so the character's zLine (usually near feet) lands on spawn tile center. */
  private getPlayerSpawnPx(worldData: WorldData, charConfig: Record<string, unknown> | null): { x: number; y: number } {
    const spawnCenterX = worldData.spawnX * this.tileSize + this.tileSize / 2;
    const spawnCenterY = worldData.spawnY * this.tileSize + this.tileSize / 2;
    const frameHeightTiles = typeof charConfig?.frameHeightTiles === "number" ? Math.max(1, charConfig.frameHeightTiles) : 3;
    const zLine = typeof charConfig?.zLine === "number" ? Math.max(0, Math.min(1, charConfig.zLine)) : 0.95;
    const spriteHeight = frameHeightTiles * this.tileSize;

    // Sprite anchor is (0.5, 0.5): worldZ = centerY - h/2 + h*zLine.
    // Solve centerY so worldZ equals spawn tile center Y.
    const centerY = spawnCenterY - (zLine - 0.5) * spriteHeight;
    return { x: spawnCenterX, y: centerY };
  }

  /** Gather all tileset sources that need loading: tiles + objects + character + animations */
  private getAllTilesetSources(): string[] {
    const sources = new Set<string>();
    // Tile registry sources (includes dev tiles)
    for (const s of getUniqueTilesetSources()) sources.add(s);
    // Custom object sources
    for (const s of this.getCustomObjectTextureSources(this.worldData)) sources.add(s);
    // Character config tileset
    const charConfig = this.getCharacterConfig();
    if (charConfig && typeof charConfig.tilesetSrc === "string" && charConfig.tilesetSrc) {
      sources.add(charConfig.tilesetSrc);
    }
    // Animation def tilesets
    const anims = this.getAnimationDefs();
    for (const anim of Object.values(anims)) {
      if (anim.tilesetSrc) sources.add(anim.tilesetSrc);
    }
    return this.sanitizeTextureSources([...sources]);
  }

  constructor(options: EngineOptions) {
    this.worldData = options.worldData;
    this.tileSize = options.tileSize ?? DEFAULT_TILE_SIZE;
    this.showSpawnMarker = options.showSpawnMarker ?? false;
    this.onInteraction = options.onInteraction;
    this.onInteractionProximity = options.onInteractionProximity;
    this.onMouseHover = options.onMouseHover;
    this.onAfterFrame = options.onAfterFrame;
    this.onError = options.onError;
    this.canvas = options.canvas;
  }

  async init(): Promise<void> {
    // Register bundled assets from world data (self-contained worlds)
    const assets = this.worldData.assets;
    if (assets?.tiles?.length) {
      registerDevTiles(assets.tiles);
    } else {
      initDevTiles(); // fallback to localStorage
    }

    // Register autotile maps from bundled assets
    if (assets?.autotileCenterVariants) {
      for (const [src, variants] of Object.entries(assets.autotileCenterVariants)) {
        setCenterVariants(src, variants);
      }
    }
    if (assets?.autotileLinearMaps) {
      for (const [src, map] of Object.entries(assets.autotileLinearMaps)) {
        setCustomLinearMap(src, map);
      }
    }

    // Reset the global PixiJS Assets cache so stale GPU textures from
    // previously destroyed engines aren't reused (they're dead after context destroy).
    Assets.reset();

    this.app = new Application();

    const dpr = Math.min(window.devicePixelRatio, 2);

    await this.app.init({
      canvas: this.canvas,
      resizeTo: this.canvas.parentElement ?? undefined,
      resolution: dpr,
      autoDensity: true,
      antialias: false,
      backgroundColor: 0x1a1a2e,
      autoStart: false,
      preference: 'webgl',
    });

    if (this.isDestroyed) return;

    // Patch PixiJS GL context to prevent null.split crash in logPrettyShaderError
    // (PixiJS 8.17.1 bug: gl.getShaderSource() can return null when context is lost)
    this.patchGlContext();

    // Handle WebGL context loss (e.g. from too many contexts during HMR)
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    // World container — moves with camera
    this.worldContainer = new Container();
    // Enable PixiJS event propagation so pointer events reach child sprites.
    // hitArea on stage is required in PixiJS v8 for pointermove to propagate,
    // which is needed for pointerover/pointerout on child sprites.
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.worldContainer.eventMode = 'static';
    this.app.stage.addChild(this.worldContainer);

    // Load tileset textures (parallel for faster page load)
    const sources = this.getAllTilesetSources();
    const textureResults = await Promise.all(
      sources.map(async (src) => {
        try {
          const tex = await this.loadTexture(src);
          return { src, tex };
        } catch (e) {
          console.warn('Engine: failed to load tileset texture:', src, e);
          return { src, tex: null };
        }
      })
    );
    for (const { src, tex } of textureResults) {
      if (tex) this.tilesetTextures[src] = tex;
    }

    if (this.isDestroyed) return;

    // Build collision map from tiles + walkability + object collision shapes
    const objectDefs = this.getCustomObjectDefs();
    this.collisionMap = new CollisionMap(
      this.worldData.layers,
      this.worldData.gridWidth,
      this.worldData.gridHeight,
      this.tileSize,
      this.worldData.objects,
      objectDefs
    );

    // Tile renderer (sprite-based with tileset textures)
    this.tileRenderer = new TileRenderer(
      this.worldData,
      this.tileSize,
      this.worldContainer,
      this.tilesetTextures,
      this.showSpawnMarker,
    );
    this.tileRenderer.buildLayers();

    // Wind overlay (global visual effect)
    const windConfig = loadWindConfig();
    this.windOverlay = new WindOverlay(this.worldContainer, windConfig);

    // Player
    const charConfig = this.getCharacterConfig();
    const spawnPx = this.getPlayerSpawnPx(this.worldData, charConfig);
    const animDefs = this.getAnimationDefs();
    this.player = new Player(
      spawnPx.x,
      spawnPx.y,
      this.tileSize,
      this.tileRenderer.getObjectsContainer(),
      this.getCharacterCollisionSize(),
      charConfig as ConstructorParameters<typeof Player>[5],
      this.tilesetTextures,
      animDefs,
    );
    this.player.updateZIndex();

    // Camera
    const worldWidth = this.worldData.gridWidth * this.tileSize;
    const worldHeight = this.worldData.gridHeight * this.tileSize;
    this.camera = new Camera(worldWidth, worldHeight);
    this.camera.snapTo(spawnPx.x, spawnPx.y, this.app.screen.width, this.app.screen.height);

    // Interaction manager
    this.interactionManager = new InteractionManager(
      this.worldData.objects,
      this.tileSize,
      objectDefs,
      this.onInteraction,
      this.onInteractionProximity,
    );

    // Set up PixiJS pointer events on interactable sprites (click + hover)
    this.setupInteractableEvents();

    // Input
    this.inputManager = new InputManager();
    this.inputManager.attach();
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });

    // Start game loop with our own RAF to catch render errors
    if (this.isDestroyed) return;

    // Warmup render — triggers shader compilation before game loop starts
    try {
      this.app.renderer.render(this.app.stage);
    } catch (e) {
      console.warn('Engine: warmup render failed, WebGL may be unstable:', e);
    }

    if (this.isDestroyed) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private patchGlContext(): void {
    const gl = (this.app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
    if (!gl) return;
    // Prevent PixiJS crash: gl.getShaderSource(null) returns null → null.split('\n') throws
    const origGetShaderSource = gl.getShaderSource.bind(gl);
    gl.getShaderSource = (shader: WebGLShader): string => {
      try { return origGetShaderSource(shader) ?? ''; } catch { return ''; }
    };
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault(); // signal browser we may want to restore
    this.contextLost = true;
    // Just pause — don't fire onError. The context may be restored,
    // or the user can Stop+Play again. No need for a scary error.
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
  };

  private loop = (time: number): void => {
    if (!this.running || this.isDestroyed) return;
    // Skip rendering while context is lost — keep RAF alive so we resume when restored
    if (this.contextLost) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }
    this.rafId = requestAnimationFrame(this.loop);
    const deltaMS = Math.min(time - this.lastTime, 100); // cap to 100ms
    this.lastTime = time;
    try {
      this.updateFrame(deltaMS / 1000, deltaMS);
      this.app.renderer.render(this.app.stage);
      this.renderErrors = 0; // reset on success
    } catch (err) {
      this.renderErrors++;
      if (this.renderErrors > 3) {
        console.error('Engine render error (giving up after retries):', err);
        this.running = false;
        cancelAnimationFrame(this.rafId);
        this.onError?.(err);
      }
    }
  };

  /** Attach PixiJS pointer events to interactable custom object sprites. */
  private setupInteractableEvents(): void {
    if (this.canvasMouseMoveHandler) {
      this.canvas.removeEventListener('mouseleave', this.canvasMouseMoveHandler);
      this.canvasMouseMoveHandler = null;
    }
    if (this.stagePointerMoveHandler) {
      this.app.stage.off('pointermove', this.stagePointerMoveHandler);
      this.stagePointerMoveHandler = null;
    }

    const container = this.tileRenderer.getObjectsContainer();
    const interactableIds = new Set<string>();

    const clearHover = () => {
      if (this.mouseHoveredObjectId !== null) {
        this.mouseHoveredObjectId = null;
        this.onMouseHover?.(null);
      }
    };

    for (const child of container.children) {
      const label = child.label;
      if (!label?.startsWith('obj-')) continue;
      const objectId = label.slice(4);
      const obj = this.worldData.objects.find((o) => o.id === objectId);
      if (!obj || obj.payload.kind !== 'custom') continue;
      const cpayload = obj.payload as CustomObjectPayload;
      // Interactable is defined on ObjectDef (admin-level), with fallback to legacy per-instance flag
      const objectDefs = this.getCustomObjectDefs();
      const def = objectDefs[cpayload.objectDefId];
      const isInteractable = def?.interactable ?? cpayload.interactable ?? false;
      if (!isInteractable) continue;
      interactableIds.add(objectId);

      child.on('pointertap', () => {
        this.interactionManager.tryTriggerObjectId(objectId);
      });
      child.on('pointerover', () => {
        if (this.mouseHoveredObjectId !== objectId) {
          this.mouseHoveredObjectId = objectId;
          this.onMouseHover?.(objectId);
        }
      });
      child.on('pointerout', () => {
        if (this.mouseHoveredObjectId === objectId) {
          clearHover();
        }
      });
      child.on('pointerleave', () => {
        if (this.mouseHoveredObjectId === objectId) {
          clearHover();
        }
      });
    }

    // Fallback: if pointer moves over non-interactable targets, clear stale hover.
    this.stagePointerMoveHandler = (e: unknown) => {
      let node = (e as { target?: { label?: string; parent?: unknown } })?.target ?? null;
      let hoveredId: string | null = null;
      while (node) {
        const label = (node as { label?: string }).label;
        if (label?.startsWith('obj-')) {
          const id = label.slice(4);
          if (interactableIds.has(id)) hoveredId = id;
          break;
        }
        node = (node as { parent?: unknown }).parent ?? null;
      }
      if (!hoveredId) clearHover();
    };
    this.app.stage.on('pointermove', this.stagePointerMoveHandler);

    // Canvas mouseleave clears hover when pointer exits the canvas entirely
    const leaveHandler = () => {
      clearHover();
    };
    this.canvas.addEventListener('mouseleave', leaveHandler);
    // Store for cleanup
    this.canvasMouseMoveHandler = leaveHandler as unknown as (e: MouseEvent) => void;
  }

  private updateFrame(dt: number, deltaMS: number): void {
    const dir = this.inputManager.getDirection();

    // Compute viewport bounds in world coordinates for culling/animation optimization.
    // camera.x/y is the top-left world position; screen size / zoom gives visible area.
    const screen = this.app.screen;
    const invZoom = 1 / this.camera.zoom;
    const viewport = {
      minX: this.camera.x - this.tileSize,         // pad by 1 tile
      minY: this.camera.y - this.tileSize,
      maxX: this.camera.x + screen.width * invZoom + this.tileSize,
      maxY: this.camera.y + screen.height * invZoom + this.tileSize,
    };

    // Animate water background (viewport-bounded)
    this.tileRenderer.updateWaterAnimation(deltaMS, viewport);
    this.tileRenderer.updateObjectAnimations(deltaMS, viewport);

    // Animate wind streaks
    this.windOverlay?.update(deltaMS, viewport);

    // Move player
    const vx = dir.x * PLAYER_SPEED;
    const vy = dir.y * PLAYER_SPEED;

    if (vx !== 0 || vy !== 0) {
      const newX = this.player.x + vx * dt;
      const newY = this.player.y + vy * dt;

      // Collision resolution — separate axes
      // Apply offset from character collision shape {x, y} within the frame
      const charConfig = this.getCharacterConfig();
      let offsetX = 0, offsetY = 0;
      if (charConfig && typeof charConfig.collision === 'object' && charConfig.collision) {
        const c = charConfig.collision as { x?: number; y?: number; w?: number; h?: number };
        const fwt = (charConfig.frameWidthTiles as number) ?? 3;
        const fht = (charConfig.frameHeightTiles as number) ?? 3;
        const fw = fwt * this.tileSize;
        const fh = fht * this.tileSize;
        // Collision box center in frame-local coords: (x + w/2, y + h/2) * frame-size - frame-size/2
        const cx = (typeof c.x === 'number' && typeof c.w === 'number') ? (c.x + c.w / 2 - 0.5) * fw : 0;
        const cy = (typeof c.y === 'number' && typeof c.h === 'number') ? (c.y + c.h / 2 - 0.5) * fh : 0;
        offsetX = cx;
        offsetY = cy;
      }

      const resolvedX = this.collisionMap.canMoveTo(newX + offsetX, this.player.y + offsetY, this.player.size, this.tileSize)
        ? newX + offsetX
        : this.player.x + offsetX;
      const resolvedY = this.collisionMap.canMoveTo(resolvedX, newY + offsetY, this.player.size, this.tileSize)
        ? newY + offsetY
        : this.player.y + offsetY;

      this.player.setPosition(resolvedX - offsetX, resolvedY - offsetY);
      this.player.setDirection(dir.x, dir.y);
      this.player.setMoving(true);
    } else {
      this.player.setMoving(false);
    }

    this.player.update(dt);
    this.player.updateZIndex();

    // Camera follow
    this.camera.follow(this.player.x, this.player.y, screen.width, screen.height, dt);
    this.worldContainer.scale.set(this.camera.zoom);
    this.worldContainer.position.set(-this.camera.x * this.camera.zoom, -this.camera.y * this.camera.zoom);
    // Fire after-frame now: world transforms are set, getBounds() reflects this frame.
    this.onAfterFrame?.();

    // Interactions
    this.interactionManager.checkProximity(this.player.x, this.player.y);

    if (this.inputManager.consumeInteract()) {
      this.interactionManager.tryTriggerKeyboard();
    }
  }

  /** Trigger interaction externally (e.g. from touch button). */
  triggerInteraction(): void {
    this.interactionManager.tryTrigger();
  }

  /** Get the screen position of a world object (for HTML overlays). */
  getObjectScreenPosition(objectId: string, anchorOverride?: { x: number; y: number }): { x: number; y: number } | null {
    if (!this.camera || !this.app) return null;

    // Read per-instance hover anchor (normalized 0-1 within sprite bounds)
    const obj = this.worldData.objects.find((o) => o.id === objectId);
    const anchor = anchorOverride ?? (obj?.payload.kind === 'custom'
      ? (obj.payload as CustomObjectPayload).hoverAnchor
      : undefined) ?? { x: 0.5, y: 0 };

    // Prefer rendered sprite bounds so overlays stay attached to the exact
    // on-screen object even when animation frames/size differ from grid math.
    const objectsContainer = this.tileRenderer.getObjectsContainer();
    const node = objectsContainer.children.find((child) => child.label === `obj-${objectId}`) as
      | {
        getBounds?: () => { x: number; y: number; width: number; height: number };
      }
      | undefined;
    if (node?.getBounds) {
      const bounds = node.getBounds();
      const cssW = Math.max(1, this.canvas.clientWidth || this.app.screen.width);
      const cssH = Math.max(1, this.canvas.clientHeight || this.app.screen.height);
      const scaleX = this.app.screen.width / cssW;
      const scaleY = this.app.screen.height / cssH;
      const x = (bounds.x + bounds.width * anchor.x) / scaleX;
      const y = (bounds.y + bounds.height * anchor.y) / scaleY;
      return {
        x,
        y,
      };
    }

    if (!obj) return null;
    const worldX = obj.gridX * this.tileSize + this.tileSize * anchor.x;
    const worldY = obj.gridY * this.tileSize + this.tileSize * anchor.y;
    const pxX = (worldX - this.camera.x) * this.camera.zoom;
    const pxY = (worldY - this.camera.y) * this.camera.zoom;
    const cssW = Math.max(1, this.canvas.clientWidth || this.app.screen.width);
    const cssH = Math.max(1, this.canvas.clientHeight || this.app.screen.height);
    const scaleX = this.app.screen.width / cssW;
    const scaleY = this.app.screen.height / cssH;
    const screenX = pxX / scaleX;
    const screenY = pxY / scaleY;
    return { x: screenX, y: screenY };
  }

  /** Returns the current camera zoom level (range: 1.2 – 3.0, default 2.2). */
  getCameraZoom(): number {
    return this.camera?.zoom ?? 2.2;
  }

  /** Check whether a world object is within (or near) the visible viewport. */
  isObjectInViewport(objectId: string, padding = 64): boolean {
    if (!this.camera || !this.app) return false;
    const obj = this.worldData.objects.find((o) => o.id === objectId);
    if (!obj) return false;
    const screen = this.app.screen;
    const invZoom = 1 / this.camera.zoom;
    const vMinX = this.camera.x - padding;
    const vMinY = this.camera.y - padding;
    const vMaxX = this.camera.x + screen.width * invZoom + padding;
    const vMaxY = this.camera.y + screen.height * invZoom + padding;
    const ox = obj.gridX * this.tileSize;
    const oy = obj.gridY * this.tileSize;
    return ox + this.tileSize >= vMinX && ox <= vMaxX &&
           oy + this.tileSize >= vMinY && oy <= vMaxY;
  }

  /** For mobile touch D-pad */
  setDirection(x: number, y: number): void {
    this.inputManager.setExternalDirection(x, y);
  }

  /** Reload world data (for editor preview) */
  reloadWorld(worldData: WorldData): void {
    initDevTiles();
    this.worldData = worldData;
    this.worldContainer.removeChildren();

    const objectDefs = this.getCustomObjectDefs();

    this.collisionMap.rebuild(
      worldData.layers,
      worldData.gridWidth,
      worldData.gridHeight,
      this.tileSize,
      worldData.objects,
      objectDefs
    );

    this.tileRenderer.setWorldData(worldData);
    this.tileRenderer.buildLayers();

    // Re-create wind overlay with fresh config
    this.windOverlay?.destroy();
    const windConfig = loadWindConfig();
    this.windOverlay = new WindOverlay(this.worldContainer, windConfig);

    const charConfig = this.getCharacterConfig();
    const spawnPx = this.getPlayerSpawnPx(worldData, charConfig);
    const animDefs = this.getAnimationDefs();
    this.player = new Player(
      spawnPx.x,
      spawnPx.y,
      this.tileSize,
      this.tileRenderer.getObjectsContainer(),
      this.getCharacterCollisionSize(),
      charConfig as ConstructorParameters<typeof Player>[5],
      this.tilesetTextures,
      animDefs,
    );
    this.player.updateZIndex();
    this.camera.snapTo(spawnPx.x, spawnPx.y, this.app.screen.width, this.app.screen.height);

    this.interactionManager.setObjects(worldData.objects, objectDefs);

    // Re-attach PixiJS pointer events for interactable sprites
    this.setupInteractableEvents();
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.canvas.removeEventListener("wheel", this.onWheel);
    if (this.canvasMouseMoveHandler) {
      this.canvas.removeEventListener('mouseleave', this.canvasMouseMoveHandler);
      this.canvasMouseMoveHandler = null;
    }
    if (this.stagePointerMoveHandler) {
      this.app.stage.off('pointermove', this.stagePointerMoveHandler);
      this.stagePointerMoveHandler = null;
    }
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.windOverlay?.destroy();
    this.inputManager?.detach();
    try {
      this.app?.destroy(false, { children: true });
    } catch {
      // PixiJS may throw if destroy() is called before init() finishes
    }
    this.app = null!;
  }
}
