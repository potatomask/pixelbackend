import { Container, Graphics, Sprite, Texture, Rectangle } from "pixi.js";
import type { WorldData, WorldAssets, ObjectDef, CustomObjectPayload, AnimationDef, AnimationFrame } from "@mypixelpage/shared";
import { getTileDef, TILE_EMPTY, TILESET_TILE_SIZE, getAutoTileSrc, isTerrainAutoTile, isLinearAutoTile, getLinearAutoTileSrc, getTerrainAutoTileQuadrants, getCenterVariant, setCenterVariants, setCustomLinearMap, WATER_TILE_ID, WATER_FRAMES, WATER_FRAME_MS } from "@mypixelpage/shared";
import type { TileLayer } from "@mypixelpage/shared";

function loadObjectDefsMap(assets?: WorldAssets): Record<string, ObjectDef> {
  const merged: Record<string, ObjectDef> = {};
  // Start with bundled assets
  if (assets?.objects?.length) {
    Object.assign(merged, Object.fromEntries(assets.objects.map((obj) => [obj.id, obj])));
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
    // Local defs override bundled defs (matches engine behavior)
    Object.assign(merged, Object.fromEntries(defs.map((obj) => [obj.id, obj])));
    return merged;
  } catch {
    return merged;
  }
}

function loadAnimationDefsMap(assets?: WorldAssets): Record<string, AnimationDef> {
  const merged: Record<string, AnimationDef> = {};
  // Start with bundled assets
  if (assets?.animations?.length) {
    Object.assign(merged, Object.fromEntries(assets.animations.map((anim) => [anim.id, anim])));
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
    // Local defs override bundled defs (matches engine behavior)
    Object.assign(merged, Object.fromEntries(defs.map((anim) => [anim.id, anim])));
    return merged;
  } catch {
    return merged;
  }
}

interface AnimatedObjectSprite {
  sprite: Sprite;
  animation: AnimationDef;
  frameWidthTiles: number;
  frameHeightTiles: number;
  elapsedMs: number;
  horizontalFlip?: boolean;
  basePositionX: number;  // Store the base (non-flipped) position
  cachedTextures?: Texture[];
}

function resolveAnimationFrameByElapsed(frames: AnimationFrame[], loop: boolean, elapsedMs: number): AnimationFrame | null {
  if (frames.length === 0) return null;
  const durations = frames.map((frame) => Math.max(16, frame.durationMs));
  const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
  if (totalDuration <= 0) return frames[0] ?? null;

  let remaining = loop ? elapsedMs % totalDuration : Math.min(elapsedMs, totalDuration - 1);
  for (let index = 0; index < frames.length; index++) {
    remaining -= durations[index] ?? 16;
    if (remaining < 0) return frames[index] ?? null;
  }
  return frames[frames.length - 1] ?? null;
}

export class TileRenderer {
  private worldData: WorldData;
  private tileSize: number;
  private parent: Container;
  private textures: Record<string, Texture>;
  private showSpawnMarker: boolean;

  private tileContainer!: Container;
  private waterContainer!: Container;
  private objectsContainer!: Container;
  private spawnMarker!: Container;
  private waterSprites: Sprite[] = [];
  private waterFrameTextures: Texture[] = [];
  private animatedObjectSprites: AnimatedObjectSprite[] = [];
  private waterFrameIndex = 0;
  private waterTimer = 0;
  private gridWidth = 0;

  constructor(
    worldData: WorldData,
    tileSize: number,
    parent: Container,
    textures: Record<string, Texture>,
    showSpawnMarker = false,
  ) {
    this.worldData = worldData;
    this.tileSize = tileSize;
    this.parent = parent;
    this.textures = textures;
    this.showSpawnMarker = showSpawnMarker;
  }

  setWorldData(worldData: WorldData): void {
    this.worldData = worldData;
  }

  buildLayers(): void {
    this.parent.removeChildren();

    // Load autotile maps — prefer bundled assets, fall back to localStorage
    const assets = this.worldData.assets;
    if (assets?.autotileCenterVariants) {
      for (const [tilesetSrc, variants] of Object.entries(assets.autotileCenterVariants)) {
        setCenterVariants(tilesetSrc, variants);
      }
    } else if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("autotile-center-variants");
        if (raw) {
          const map = JSON.parse(raw) as Record<string, { col: number; row: number; weight: number }[]>;
          for (const [tilesetSrc, variants] of Object.entries(map)) {
            setCenterVariants(tilesetSrc, variants);
          }
        }
      } catch { /* ignore */ }
    }

    if (assets?.autotileLinearMaps) {
      for (const [src, map] of Object.entries(assets.autotileLinearMaps)) {
        setCustomLinearMap(src, map);
      }
    } else if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("autotile-linear-maps");
        if (raw) {
          const maps = JSON.parse(raw) as Record<string, { col: number; row: number }[]>;
          for (const [src, map] of Object.entries(maps)) {
            setCustomLinearMap(src, map);
          }
        }
      } catch { /* ignore */ }
    }

    this.gridWidth = this.worldData.gridWidth;

    this.waterContainer = new Container();
    this.waterContainer.label = "water";
    this.waterContainer.cullableChildren = true;
    this.parent.addChild(this.waterContainer);

    this.tileContainer = new Container();
    this.tileContainer.label = "tiles";
    this.tileContainer.cullableChildren = true;
    this.parent.addChild(this.tileContainer);

    this.objectsContainer = new Container();
    this.objectsContainer.label = "objects";
    this.objectsContainer.sortableChildren = true;
    this.objectsContainer.cullableChildren = true;
    this.objectsContainer.eventMode = 'static';
    this.parent.addChild(this.objectsContainer);

    this.spawnMarker = new Container();
    this.spawnMarker.label = "spawn";
    this.parent.addChild(this.spawnMarker);
    this.animatedObjectSprites = [];

    this.buildWaterBackground();
    this.buildTiles();
    this.buildObjects();
    if (this.showSpawnMarker) {
      this.buildSpawn();
    }
  }

  private buildWaterBackground(): void {
    const { gridHeight, gridWidth } = this.worldData;
    const ts = this.tileSize;
    const waterDef = getTileDef(WATER_TILE_ID);
    if (!waterDef?.tilesetSrc || !this.textures[waterDef.tilesetSrc]) return;
    const base = this.textures[waterDef.tilesetSrc]!;

    // Pre-cache water frame textures to avoid creating new Texture objects every tick
    this.waterFrameTextures = [];
    for (let i = 0; i < WATER_FRAMES; i++) {
      this.waterFrameTextures.push(new Texture({
        source: base.source,
        frame: new Rectangle(i * TILESET_TILE_SIZE, 0, TILESET_TILE_SIZE, TILESET_TILE_SIZE),
      }));
    }

    this.waterSprites = [];
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const sprite = new Sprite(this.waterFrameTextures[0]!);
        sprite.position.set(x * ts, y * ts);
        sprite.width = ts;
        sprite.height = ts;
        sprite.cullable = true;
        this.waterContainer.addChild(sprite);
        this.waterSprites.push(sprite);
      }
    }
  }

  /** Call from game loop with delta ms to animate water tiles.
   *  When viewport is provided, only updates sprites within the visible area. */
  updateWaterAnimation(deltaMs: number, viewport?: { minX: number; minY: number; maxX: number; maxY: number }): void {
    this.waterTimer += deltaMs;
    if (this.waterTimer < WATER_FRAME_MS) return;
    this.waterTimer -= WATER_FRAME_MS;
    this.waterFrameIndex = (this.waterFrameIndex + 1) % WATER_FRAMES;

    const tex = this.waterFrameTextures[this.waterFrameIndex];
    if (!tex) return;

    if (viewport) {
      const ts = this.tileSize;
      const gw = this.gridWidth;
      const colMin = Math.max(0, Math.floor(viewport.minX / ts));
      const colMax = Math.min(gw - 1, Math.floor(viewport.maxX / ts));
      const rowMin = Math.max(0, Math.floor(viewport.minY / ts));
      const rowMax = Math.min(this.worldData.gridHeight - 1, Math.floor(viewport.maxY / ts));
      for (let r = rowMin; r <= rowMax; r++) {
        for (let c = colMin; c <= colMax; c++) {
          const idx = r * gw + c;
          const sprite = this.waterSprites[idx];
          if (sprite) sprite.texture = tex;
        }
      }
    } else {
      for (const sprite of this.waterSprites) {
        sprite.texture = tex;
      }
    }
  }

  updateObjectAnimations(deltaMs: number, viewport?: { minX: number; minY: number; maxX: number; maxY: number }): void {
    if (this.animatedObjectSprites.length === 0) return;
    for (const animated of this.animatedObjectSprites) {
      // Skip texture swap for sprites entirely outside the viewport
      if (viewport) {
        const s = animated.sprite;
        const sx = s.position.x;
        const sy = s.position.y;
        if (sx + s.width < viewport.minX || sx > viewport.maxX ||
            sy + s.height < viewport.minY || sy > viewport.maxY) {
          continue;
        }
      }
      animated.elapsedMs += deltaMs;
      const frame = resolveAnimationFrameByElapsed(animated.animation.frames, animated.animation.loop, animated.elapsedMs);
      if (!frame) continue;
      // Use pre-cached texture if available for this frame index
      const frameIdx = animated.animation.frames.indexOf(frame);
      if (frameIdx >= 0 && animated.cachedTextures?.[frameIdx]) {
        const widthTiles = (frame.widthTiles ?? animated.frameWidthTiles);
        const heightTiles = (frame.heightTiles ?? animated.frameHeightTiles);
        animated.sprite.texture = animated.cachedTextures[frameIdx];
        animated.sprite.width = widthTiles * this.tileSize;
        animated.sprite.height = heightTiles * this.tileSize;
        // Flip by negating the existing scale.x (which was set by .width)
        const shouldFlip = (frame.horizontalFlip ?? animated.horizontalFlip) ?? false;
        if (shouldFlip) {
          animated.sprite.scale.x = -Math.abs(animated.sprite.scale.x);
          animated.sprite.position.x = animated.basePositionX + widthTiles * this.tileSize;
        } else {
          animated.sprite.scale.x = Math.abs(animated.sprite.scale.x);
          animated.sprite.position.x = animated.basePositionX;
        }
        continue;
      }
      const base = this.textures[animated.animation.tilesetSrc];
      if (!base) continue;
      const widthTiles = (frame.widthTiles ?? animated.frameWidthTiles);
      const heightTiles = (frame.heightTiles ?? animated.frameHeightTiles);
      const frameHorizontalFlip = frame.horizontalFlip ?? animated.horizontalFlip ?? false;
      const tex = new Texture({
        source: base.source,
        frame: new Rectangle(
          frame.srcX,
          frame.srcY,
          widthTiles * TILESET_TILE_SIZE,
          heightTiles * TILESET_TILE_SIZE,
        ),
      });
      // Cache for next time
      if (!animated.cachedTextures) animated.cachedTextures = [];
      animated.cachedTextures[frameIdx] = tex;
      animated.sprite.texture = tex;
      animated.sprite.width = widthTiles * this.tileSize;
      animated.sprite.height = heightTiles * this.tileSize;
      // Flip by negating the existing scale.x (which was set by .width)
      const shouldFlip = frameHorizontalFlip;
      if (shouldFlip) {
        animated.sprite.scale.x = -Math.abs(animated.sprite.scale.x);
        animated.sprite.position.x = animated.basePositionX + widthTiles * this.tileSize;
      } else {
        animated.sprite.scale.x = Math.abs(animated.sprite.scale.x);
        animated.sprite.position.x = animated.basePositionX;
      }
    }
  }

  private buildTiles(): void {
    const { layers, gridHeight, gridWidth } = this.worldData;
    const ts = this.tileSize;

    // Render all tile layers in z-order (supports custom z3+ layers).
    for (let z = 0 as TileLayer; z < layers.length; z++) {
      const layerGrid = layers[z];
      if (!layerGrid) continue;
      for (let y = 0; y < gridHeight; y++) {
        const row = layerGrid[y];
        if (!row) continue;
        for (let x = 0; x < gridWidth; x++) {
          const tileId = row[x] ?? TILE_EMPTY;
          if (tileId === TILE_EMPTY) continue;

          const def = getTileDef(tileId);
          if (!def) continue;

          if (def.tilesetSrc && this.textures[def.tilesetSrc]) {
            const base = this.textures[def.tilesetSrc]!;

            if (def.autoTile && isTerrainAutoTile(tileId)) {
              // Terrain: 4×8×8 quadrant composition for inner corners
              const quads = getTerrainAutoTileQuadrants(layers, x, y, tileId);
              const half = TILESET_TILE_SIZE / 2;
              const halfTs = ts / 2;

              // Detect fully-surrounded center tile
              const cX = 1 * TILESET_TILE_SIZE;
              const cY = 1 * TILESET_TILE_SIZE;
              const isFullCenter =
                quads.tl.srcX === cX && quads.tl.srcY === cY &&
                quads.tr.srcX === cX + half && quads.tr.srcY === cY &&
                quads.bl.srcX === cX && quads.bl.srcY === cY + half &&
                quads.br.srcX === cX + half && quads.br.srcY === cY + half;
              const variant = isFullCenter && def.tilesetSrc ? getCenterVariant(def.tilesetSrc, x, y) : null;

              if (variant) {
                // Full center variant tile
                const subTex = new Texture({
                  source: base.source,
                  frame: new Rectangle(variant.srcX, variant.srcY, TILESET_TILE_SIZE, TILESET_TILE_SIZE),
                });
                const sprite = new Sprite(subTex);
                sprite.position.set(x * ts, y * ts);
                sprite.width = ts;
                sprite.height = ts;
                this.tileContainer.addChild(sprite);
                // Overlay on variant
                if (def.overlaySrc && this.textures[def.overlaySrc]) {
                  const overlayBase = this.textures[def.overlaySrc]!;
                  const oTex = new Texture({
                    source: overlayBase.source,
                    frame: new Rectangle(variant.srcX, variant.srcY, TILESET_TILE_SIZE, TILESET_TILE_SIZE),
                  });
                  const oSprite = new Sprite(oTex);
                  oSprite.position.set(x * ts, y * ts);
                  oSprite.width = ts;
                  oSprite.height = ts;
                  this.tileContainer.addChild(oSprite);
                }
              } else {
              const qList: [{ srcX: number; srcY: number }, number, number][] = [
                [quads.tl, 0, 0],
                [quads.tr, halfTs, 0],
                [quads.bl, 0, halfTs],
                [quads.br, halfTs, halfTs],
              ];
              for (const [q, offX, offY] of qList) {
                const subTex = new Texture({
                  source: base.source,
                  frame: new Rectangle(q.srcX, q.srcY, half, half),
                });
                const sprite = new Sprite(subTex);
                sprite.position.set(x * ts + offX, y * ts + offY);
                sprite.width = halfTs;
                sprite.height = halfTs;
                this.tileContainer.addChild(sprite);
              }
              // Overlay layer (e.g. grass detail)
              if (def.overlaySrc && this.textures[def.overlaySrc]) {
                const overlayBase = this.textures[def.overlaySrc]!;
                for (const [q, offX, offY] of qList) {
                  const subTex = new Texture({
                    source: overlayBase.source,
                    frame: new Rectangle(q.srcX, q.srcY, half, half),
                  });
                  const sprite = new Sprite(subTex);
                  sprite.position.set(x * ts + offX, y * ts + offY);
                  sprite.width = halfTs;
                  sprite.height = halfTs;
                  this.tileContainer.addChild(sprite);
                }
              }
              }
            } else if (def.autoTile && isLinearAutoTile(tileId)) {
              // Linear (bridge): dedicated state-based auto-tile
              const src = getLinearAutoTileSrc(layers, x, y, tileId);
              const subTex = new Texture({
                source: base.source,
                frame: new Rectangle(src.srcX, src.srcY, TILESET_TILE_SIZE, TILESET_TILE_SIZE),
              });
              const sprite = new Sprite(subTex);
              sprite.position.set(x * ts, y * ts);
              sprite.width = ts;
              sprite.height = ts;
              this.tileContainer.addChild(sprite);
            } else {
              // Path tiles or non-auto: single tile via cardinal bitmask
              const src = def.autoTile
                ? getAutoTileSrc(layers, x, y, tileId)
                : { srcX: def.srcX, srcY: def.srcY };
              const subTex = new Texture({
                source: base.source,
                frame: new Rectangle(src.srcX, src.srcY, TILESET_TILE_SIZE, TILESET_TILE_SIZE),
              });
              const sprite = new Sprite(subTex);
              sprite.position.set(x * ts, y * ts);
              sprite.width = ts;
              sprite.height = ts;
              this.tileContainer.addChild(sprite);
            }
          } else {
            const color = parseInt(def.color.slice(1), 16);
            const g = new Graphics();
            g.rect(0, 0, ts, ts).fill(color);
            g.position.set(x * ts, y * ts);
            this.tileContainer.addChild(g);
          }
        }
      }
    }
  }

  private buildSpawn(): void {
    const { spawnX, spawnY } = this.worldData;
    const ts = this.tileSize;
    const cx = ts / 2;
    const cy = ts / 2;

    const g = new Graphics();
    g.circle(cx, cy, ts * 0.3).fill({ color: 0xffdd00, alpha: 0.8 });
    g.circle(cx, cy, ts * 0.3).stroke({ color: 0xffffff, width: 1.5 });
    g.position.set(spawnX * ts, spawnY * ts);
    this.spawnMarker.addChild(g);
  }

  private buildObjects(): void {
    const assets = this.worldData.assets;
    const objectDefs = loadObjectDefsMap(assets);
    const animationDefs = loadAnimationDefsMap(assets);
    // Sort objects by gridY ascending so lower Y (behind) is drawn first
    const sorted = [...this.worldData.objects].sort((a, b) => a.gridY - b.gridY);
    for (const obj of sorted) {
      if (obj.type === "custom" && obj.payload.kind === "custom") {
        const def = objectDefs[obj.payload.objectDefId];
        if (def) {
          const animation = def.animationId ? animationDefs[def.animationId] : undefined;
          const vIdx = (obj.payload as CustomObjectPayload).variationIndex ?? 0;
          const variation = vIdx > 0 && def.variations?.[vIdx - 1] ? def.variations[vIdx - 1]! : null;
          const firstFrame = animation?.frames[0] ?? null;
          const drawSrcX = firstFrame?.srcX ?? (variation ? variation.srcX : def.srcX);
          const drawSrcY = firstFrame?.srcY ?? (variation ? variation.srcY : def.srcY);
          const drawTilesetSrc = animation?.tilesetSrc ?? variation?.tilesetSrc ?? def.tilesetSrc;
          const drawWidthTiles = firstFrame?.widthTiles ?? variation?.widthTiles ?? def.widthTiles;
          const drawHeightTiles = firstFrame?.heightTiles ?? variation?.heightTiles ?? def.heightTiles;
          const drawHorizontalFlip = variation?.horizontalFlip ?? def.horizontalFlip ?? false;
          const base = drawTilesetSrc ? this.textures[drawTilesetSrc] : undefined;
          if (base) {
            const sprite = new Sprite(new Texture({
              source: base.source,
              frame: new Rectangle(
                drawSrcX,
                drawSrcY,
                drawWidthTiles * TILESET_TILE_SIZE,
                drawHeightTiles * TILESET_TILE_SIZE,
              ),
            }));
            // gridX/gridY = bottom-left anchor. Top-left = gridY - (heightTiles - 1)
            const topY = obj.gridY - (drawHeightTiles - 1);
            sprite.position.set(obj.gridX * this.tileSize, topY * this.tileSize);
            sprite.width = drawWidthTiles * this.tileSize;
            sprite.height = drawHeightTiles * this.tileSize;
            if (drawHorizontalFlip) {
              sprite.scale.x = -1;
              sprite.position.x += sprite.width;
            }
            sprite.label = `obj-${obj.id}`;
            // Enable PixiJS pointer events for interactable custom objects
            const cpayload = obj.payload as CustomObjectPayload;
            if (def.interactable ?? cpayload.interactable) {
              sprite.eventMode = 'static';
              sprite.cursor = 'pointer';
            }
            // Z-order: check variant first, fall back to def (default true for old data)
            const variantZInteraction = variation?.zInteraction ?? def.zInteraction ?? true;
            if (variantZInteraction) {
              const zLine = variation?.zLine ?? def.zLine ?? 1;
              // Top of sprite in world coords, then offset by zLine fraction of height
              const topY = obj.gridY - (drawHeightTiles - 1);
              sprite.zIndex = (topY + drawHeightTiles * zLine) * this.tileSize;
            } else {
              sprite.zIndex = 0;
            }
            this.objectsContainer.addChild(sprite);
            if (animation && animation.frames.length > 0) {
              this.animatedObjectSprites.push({
                sprite,
                animation,
                frameWidthTiles: def.widthTiles,
                frameHeightTiles: def.heightTiles,
                basePositionX: obj.gridX * this.tileSize,
                horizontalFlip: drawHorizontalFlip,
                elapsedMs: 0,
              });
            }
            continue;
          }
        }
      }

      const marker = new Graphics();
      const ts = this.tileSize;
      marker.rect(0, 0, ts, ts);

      switch (obj.type) {
        case "modal":
          marker.fill({ color: 0x4fc3f7, alpha: 0.5 });
          break;
        case "link":
          marker.fill({ color: 0x81c784, alpha: 0.5 });
          break;
        case "media":
          marker.fill({ color: 0xffb74d, alpha: 0.5 });
          break;
        case "custom":
          marker.fill({ color: 0xf59e0b, alpha: 0.5 });
          break;
      }

      marker.position.set(obj.gridX * ts, obj.gridY * ts);
      marker.label = `obj-${obj.id}`;
      // Fallback markers don't have a def, treat as non-interactive (always behind).
      marker.zIndex = 0;
      this.objectsContainer.addChild(marker);
    }
  }

  getObjectsContainer(): Container {
    return this.objectsContainer;
  }

  /**
   * Returns the topmost object id at a world coordinate.
   * Uses rendered sprite/marker bounds (same source used by the preview scene).
   */
  getObjectIdAtWorldPos(worldX: number, worldY: number, customInteractableOnly = false): string | null {
    const children = this.objectsContainer.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i] as {
        label?: string;
        x: number;
        y: number;
        width: number;
        height: number;
      };
      const label = child.label ?? "";
      if (!label.startsWith("obj-")) continue;
      const objectId = label.slice(4);
      const obj = this.worldData.objects.find((o) => o.id === objectId);
      if (!obj) continue;

      if (customInteractableOnly) {
        if (obj.payload.kind !== "custom") continue;
        if (!(obj.payload as CustomObjectPayload).interactable) continue;
      }

      const x1 = child.x;
      const y1 = child.y;
      const x2 = x1 + child.width;
      const y2 = y1 + child.height;
      if (worldX >= x1 && worldX <= x2 && worldY >= y1 && worldY <= y2) {
        return objectId;
      }
    }
    return null;
  }
}
