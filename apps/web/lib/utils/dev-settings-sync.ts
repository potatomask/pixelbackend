/**
 * Dev Settings Storage — Server-First Architecture
 *
 * ┌─────────────┐         ┌──────────────┐
 * │  Editor UI  │──SAVE──▶│  Server DB   │  (SiteSetting table = source of truth)
 * │  (React)    │◀─LOAD───│  (SQLite)    │
 * └─────────────┘         └──────┬───────┘
 *                                │ on load success
 *                                ▼
 *                         ┌──────────────┐
 *                         │ localStorage │  (read-only cache for fast initial render)
 *                         └──────────────┘
 *
 * SAVE: Editor → Server DB (debounced 300ms for rapid edits, 3 retries)
 *       └─ on confirmed write → update localStorage cache
 *       └─ on failed write   → mark dirty, retry on next page load
 *
 * LOAD: Server DB → localStorage cache (fallback to cache if offline)
 */

const DEBOUNCE_MS = 300;
const DIRTY_KEYS_STORAGE = "__dev-settings-dirty";

// ── Write infrastructure ────────────────────────────────

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const latestValues = new Map<string, string>();

/** POST/PUT a setting to the server with 3 retries. */
async function writeToServer(key: string, value: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) return true;
      if (res.status === 401 || res.status === 403) return false;
    } catch {
      // network error
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return false;
}

// ── Dirty tracking (survives page refresh) ──────────────

function getDirtyKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(DIRTY_KEYS_STORAGE);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function markDirty(key: string): void {
  const dirty = getDirtyKeys();
  dirty.add(key);
  localStorage.setItem(DIRTY_KEYS_STORAGE, JSON.stringify([...dirty]));
}

function clearDirty(key: string): void {
  const dirty = getDirtyKeys();
  dirty.delete(key);
  if (dirty.size === 0) {
    localStorage.removeItem(DIRTY_KEYS_STORAGE);
  } else {
    localStorage.setItem(DIRTY_KEYS_STORAGE, JSON.stringify([...dirty]));
  }
}

/** Retry any previously failed writes. Called on page load. */
export async function retryDirtySettings(): Promise<void> {
  const dirty = getDirtyKeys();
  if (dirty.size === 0) return;
  for (const key of dirty) {
    const value = localStorage.getItem(key);
    if (value == null) {
      clearDirty(key);
      continue;
    }
    const ok = await writeToServer(key, value);
    if (ok) clearDirty(key);
  }
}

// ── Unload safety (sendBeacon for in-flight writes) ─────

function flushAllPending(): void {
  for (const [key, value] of latestValues.entries()) {
    const timer = pendingTimers.get(key);
    if (timer) clearTimeout(timer);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/admin/settings",
        new Blob([JSON.stringify({ key, value })], { type: "application/json" }),
      );
    }
  }
  pendingTimers.clear();
  latestValues.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushAllPending);
}

// ── Public API ──────────────────────────────────────────

/**
 * Save a dev setting → Server DB (primary target).
 * Debounced 300ms to coalesce rapid edits (e.g. sliders, color pickers).
 * On server confirm: updates localStorage cache + clears dirty flag.
 * On server failure: marks as dirty for retry on next page load.
 */
export function saveDevSetting(key: string, value: string): void {
  latestValues.set(key, value);

  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);

  pendingTimers.set(
    key,
    setTimeout(async () => {
      pendingTimers.delete(key);
      const val = latestValues.get(key);
      latestValues.delete(key);
      if (val == null) return;

      const ok = await writeToServer(key, val);
      if (ok) {
        localStorage.setItem(key, val); // cache on server confirm
        clearDirty(key);
      } else {
        // Server failed — cache locally so the value isn't lost, mark dirty for retry
        localStorage.setItem(key, val);
        markDirty(key);
        console.warn(`[dev-settings] Server write failed for "${key}", marked dirty for retry`);
      }
    }, DEBOUNCE_MS),
  );
}

/**
 * Save immediately (no debounce). Use for explicit "Save" button clicks.
 * Returns true if server accepted the write.
 */
export async function saveDevSettingImmediate(key: string, value: string): Promise<boolean> {
  // Cancel any pending debounce for this key
  const timer = pendingTimers.get(key);
  if (timer) clearTimeout(timer);
  pendingTimers.delete(key);
  latestValues.delete(key);

  const ok = await writeToServer(key, value);
  if (ok) {
    localStorage.setItem(key, value);
    clearDirty(key);
  } else {
    localStorage.setItem(key, value);
    markDirty(key);
  }
  return ok;
}

/** @deprecated Use saveDevSetting instead. */
export function syncSettingToServer(key: string, value: string): void {
  saveDevSetting(key, value);
}

/**
 * Load a dev setting FROM the server (source of truth).
 * Caches to localStorage for fast initial renders on next visit.
 * Falls back to localStorage cache only if server is unreachable.
 */
export async function loadSettingFromServer(key: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { value: string | null };
      if (data.value != null) {
        localStorage.setItem(key, data.value);
        return data.value;
      }
      return null;
    }
  } catch {
    // server unreachable
  }
  // Fallback: read from cache (may be stale)
  return localStorage.getItem(key);
}

/** All dev-setting keys managed by this system. */
export const DEV_SETTING_KEYS = [
  "dev-tiles",
  "dev-objects",
  "dev-animations",
  "dev-character-config",
  "dev-sidepage-themes",
  "dev-tag-rules",
  "dev-categories",
  "dev-credit-config",
  "dev-storage-limits",
  "dev-custom-tileset-sources",
  "autotile-custom-maps",
  "autotile-quadrant-maps",
  "autotile-center-variants",
  "autotile-linear-maps",
  "dev-wind-config",
] as const;

/** Load ALL dev settings from server into localStorage cache. Also retries dirty writes. */
export async function loadAllDevSettingsFromServer(): Promise<void> {
  await Promise.all([
    ...DEV_SETTING_KEYS.map((key) => loadSettingFromServer(key)),
    retryDirtySettings(),
  ]);
}

/**
 * @deprecated No longer needed — dirty tracking handles failed writes automatically.
 */
export function autoHealSettings(_results: Array<[string, string | null]>): void {
  // no-op: replaced by retryDirtySettings()
}
