import {
  CURRENT_WORLD_DATA_VERSION,
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
} from "./constants";
import type { WorldData } from "./types";

import { NUM_TILE_LAYERS } from "./tiles";

function createEmptyLayer(width: number, height: number): number[][] {
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );
}

/**
 * Creates an empty WorldData for a new world.
 * Three tile layers (z0-water, z1-ground, z2-overlay), spawn at center.
 */
export function createEmptyWorldData(
  width = DEFAULT_GRID_WIDTH,
  height = DEFAULT_GRID_HEIGHT
): WorldData {
  const layers: number[][][] = Array.from({ length: NUM_TILE_LAYERS }, () =>
    createEmptyLayer(width, height)
  );

  return {
    version: CURRENT_WORLD_DATA_VERSION,
    gridWidth: width,
    gridHeight: height,
    spawnX: Math.floor(width / 2),
    spawnY: Math.floor(height / 2),
    layers,
    objects: [],
  };
}
