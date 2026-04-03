import type { WorldObject, CustomObjectPayload, ObjectDef } from "@mypixelpage/shared";
import { INTERACTION_RADIUS, DEFAULT_COOLDOWN_MS } from "@mypixelpage/shared";

/** Returns true for legacy objects (modal/link/media) — proximity + keyboard based. */
function isProximityInteractable(obj: WorldObject): boolean {
  // Custom interactable objects are mouse-only, NOT proximity-based.
  if (obj.payload.kind === "custom") return false;
  return true;
}

export class InteractionManager {
  private objects: WorldObject[];
  private tileSize: number;
  private objectDefs: Record<string, ObjectDef>;
  private onInteraction?: (objectId: string) => void;
  private onProximity?: (objectId: string | null) => void;
  private cooldowns = new Map<string, number>();
  private nearbyObjectId: string | null = null;

  constructor(
    objects: WorldObject[],
    tileSize: number,
    objectDefs: Record<string, ObjectDef>,
    onInteraction?: (objectId: string) => void,
    onProximity?: (objectId: string | null) => void,
  ) {
    this.objects = objects;
    this.tileSize = tileSize;
    this.objectDefs = objectDefs;
    this.onInteraction = onInteraction;
    this.onProximity = onProximity;
  }

  setObjects(objects: WorldObject[], objectDefs: Record<string, ObjectDef>): void {
    this.objects = objects;
    this.objectDefs = objectDefs;
    this.cooldowns.clear();
    this.nearbyObjectId = null;
  }

  /** Proximity check — finds closest interactable object near the player. */
  checkProximity(playerX: number, playerY: number): void {
    const radius = INTERACTION_RADIUS * this.tileSize;
    const ts = this.tileSize;
    let closestId: string | null = null;
    let closestDist = Infinity;

    for (const obj of this.objects) {
      if (!isProximityInteractable(obj)) continue;

      // For multi-tile custom objects, use nearest point on bounding box
      let nearX: number, nearY: number;
      if (obj.payload.kind === "custom") {
        const def = this.objectDefs[(obj.payload as CustomObjectPayload).objectDefId];
        if (def) {
          const left = obj.gridX * ts;
          const top = (obj.gridY - (def.heightTiles - 1)) * ts;
          const right = left + def.widthTiles * ts;
          const bottom = (obj.gridY + 1) * ts;
          nearX = Math.max(left, Math.min(playerX, right));
          nearY = Math.max(top, Math.min(playerY, bottom));
        } else {
          nearX = obj.gridX * ts + ts / 2;
          nearY = obj.gridY * ts + ts / 2;
        }
      } else {
        nearX = obj.gridX * ts + ts / 2;
        nearY = obj.gridY * ts + ts / 2;
      }

      const dx = playerX - nearX;
      const dy = playerY - nearY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius && dist < closestDist) {
        closestDist = dist;
        closestId = obj.id;
      }
    }

    if (closestId !== this.nearbyObjectId) {
      this.nearbyObjectId = closestId;
      this.onProximity?.(closestId);
    }
  }

  /** Keyboard E/Space trigger — fires nearby interactable object. */
  tryTriggerKeyboard(): boolean {
    if (!this.nearbyObjectId) return false;

    const now = Date.now();
    const lastTrigger = this.cooldowns.get(this.nearbyObjectId) ?? 0;
    const obj = this.objects.find((o) => o.id === this.nearbyObjectId);
    const cooldown = obj?.cooldownMs ?? DEFAULT_COOLDOWN_MS;

    if (now - lastTrigger < cooldown) return false;

    this.cooldowns.set(this.nearbyObjectId, now);
    this.onInteraction?.(this.nearbyObjectId);
    return true;
  }

  /** Mobile interact button — fires whatever is nearby. */
  tryTrigger(): boolean {
    return this.tryTriggerKeyboard();
  }

  /** Trigger a specific object id with cooldown check. */
  tryTriggerObjectId(objectId: string): boolean {
    const obj = this.objects.find((o) => o.id === objectId);
    if (!obj) return false;
    const now = Date.now();
    const lastTrigger = this.cooldowns.get(objectId) ?? 0;
    if (now - lastTrigger < (obj.cooldownMs ?? DEFAULT_COOLDOWN_MS)) return false;
    this.cooldowns.set(objectId, now);
    this.onInteraction?.(objectId);
    return true;
  }

  getNearbyObjectId(): string | null {
    return this.nearbyObjectId;
  }
}
