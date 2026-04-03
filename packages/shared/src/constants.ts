// ─── Grid & World Limits ────────────────────────────

export const DEFAULT_GRID_WIDTH = 150;
export const DEFAULT_GRID_HEIGHT = 150;
export const CURRENT_WORLD_DATA_VERSION = 2;
export const DEFAULT_TILE_SIZE = 32; // display pixels per tile (2x scale of 16px source)
export const MAX_GRID_SIZE = 500;   // max grid dimension (memory safety)

// ─── Object Limits ──────────────────────────────────

export const MAX_LABEL_LENGTH = 100;
export const MAX_MODAL_BODY_LENGTH = 5000;
export const MAX_BIO_LENGTH = 280;

// ─── Player ─────────────────────────────────────────

export const PLAYER_SPEED = 160; // pixels per second (at 32px tile size = 5 tiles/sec)
export const PLAYER_SIZE = 28;  // pixels (slightly less than tile for smooth movement)

// ─── Interaction ────────────────────────────────────

export const INTERACTION_RADIUS = 1.5; // tiles
export const DEFAULT_COOLDOWN_MS = 500;

// ─── Editor ─────────────────────────────────────────

export const AUTOSAVE_DEBOUNCE_MS = 3000;
export const MAX_UNDO_STACK = 50;

// ─── Publish ────────────────────────────────────────

export const MAX_PUBLISH_RECORDS = 10;

// ─── Upload ─────────────────────────────────────────

export const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// ─── Analytics Rate Limits ──────────────────────────

export const ANALYTICS_RATE_LIMIT_PER_MIN = 10;

// (version constant defined at top of file)
