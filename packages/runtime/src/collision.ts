import { isTileWalkable } from "@mypixelpage/shared";
import type { CollisionShape, CustomObjectPayload, ObjectDef, WorldObject } from "@mypixelpage/shared";

/** Axis-aligned bounding box in pixel coordinates. */
interface AABB {
  x: number;  // left
  y: number;  // top
  w: number;  // width
  h: number;  // height
}

/**
 * Collision system.
 * - Tile walkability uses a grid-based Uint8Array (1=solid, 0=passable).
 * - Object collision uses per-object AABBs derived from the ObjectDef's
 *   CollisionShape (normalized 0-1 within the object's pixel bounds).
 *   Only objects with a non-null `collision` shape block the player.
 */
export class CollisionMap {
  private map: Uint8Array;
  private width: number;
  private height: number;
  private tileSize: number;
  private objectBoxes: AABB[] = [];

  constructor(
    layers: number[][][],
    width: number,
    height: number,
    tileSize: number,
    objects: WorldObject[] = [],
    objectDefs: Record<string, ObjectDef> = {}
  ) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.map = new Uint8Array(width * height);
    this.build(layers, objects, objectDefs);
  }

  private markSolid(gridX: number, gridY: number): void {
    if (gridX < 0 || gridY < 0 || gridX >= this.width || gridY >= this.height) return;
    this.map[gridY * this.width + gridX] = 1;
  }

  private build(
    layers: number[][][],
    objects: WorldObject[],
    objectDefs: Record<string, ObjectDef>
  ): void {
    // 1. Tile walkability
    // The highest non-empty tile layer at a cell decides walkability.
    // This ensures a non-walkable tile on a higher z-layer blocks movement,
    // even if lower layers are walkable.
    // Empty cells (all layers = TILE_EMPTY) are treated as water/background → solid.
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        let topTileId = 0;
        for (let z = layers.length - 1; z >= 0; z--) {
          const tileId = layers[z]?.[row]?.[col] ?? 0;
          if (tileId !== 0) {
            topTileId = tileId;
            break;
          }
        }
        if (topTileId === 0 || !isTileWalkable(topTileId)) {
          this.markSolid(col, row);
        }
      }
    }

    // 2. Object collision boxes (only objects with a collision shape)
    this.objectBoxes = [];
    const ts = this.tileSize;
    for (const obj of objects) {
      if (obj.type !== "custom" || obj.payload.kind !== "custom") continue;
      const def = objectDefs[obj.payload.objectDefId];
      const payload = obj.payload as CustomObjectPayload;
      const vIdx = payload.variationIndex ?? 0;
      const variation = vIdx > 0 && def?.variations?.[vIdx - 1] ? def.variations[vIdx - 1]! : null;
      const collisionEnabled = variation?.collisionEnabled ?? !!def?.collision;
      if (!collisionEnabled) continue;
      if (!def || !def.collision) continue;

      const shape = def.collision;
      const drawWidthTiles = variation?.widthTiles ?? def.widthTiles;
      const drawHeightTiles = variation?.heightTiles ?? def.heightTiles;
      // Object pixel bounds: gridX/gridY = bottom-left anchor
      const topY = obj.gridY - (drawHeightTiles - 1);
      const objPxX = obj.gridX * ts;
      const objPxY = topY * ts;
      const objPxW = drawWidthTiles * ts;
      const objPxH = drawHeightTiles * ts;

      this.objectBoxes.push({
        x: objPxX + shape.x * objPxW,
        y: objPxY + shape.y * objPxH,
        w: shape.w * objPxW,
        h: shape.h * objPxH,
      });
    }
  }

  isSolid(gridX: number, gridY: number): boolean {
    if (gridX < 0 || gridY < 0 || gridX >= this.width || gridY >= this.height) {
      return true;
    }
    return this.map[gridY * this.width + gridX] === 1;
  }

  /**
   * Check if a player-sized AABB can exist at pixel position (px, py).
   * Returns true if no collision.
   */
  canMoveTo(px: number, py: number, playerSize: number, tileSize: number): boolean {
    const half = playerSize / 2;
    const pLeft = px - half;
    const pRight = px + half;
    const pTop = py - half;
    const pBottom = py + half;

    // Grid-based tile check
    const gLeft = Math.floor(pLeft / tileSize);
    const gRight = Math.floor((pRight - 0.01) / tileSize);
    const gTop = Math.floor(pTop / tileSize);
    const gBottom = Math.floor((pBottom - 0.01) / tileSize);

    for (let gy = gTop; gy <= gBottom; gy++) {
      for (let gx = gLeft; gx <= gRight; gx++) {
        if (this.isSolid(gx, gy)) return false;
      }
    }

    // Per-object AABB check
    for (const box of this.objectBoxes) {
      if (
        pLeft < box.x + box.w &&
        pRight > box.x &&
        pTop < box.y + box.h &&
        pBottom > box.y
      ) {
        return false;
      }
    }

    return true;
  }

  /** Rebuild from new tile data (for editor reload) */
  rebuild(
    layers: number[][][],
    width: number,
    height: number,
    tileSize: number,
    objects: WorldObject[] = [],
    objectDefs: Record<string, ObjectDef> = {}
  ): void {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.map = new Uint8Array(width * height);
    this.build(layers, objects, objectDefs);
  }
}
