/**
 * Dev settings storage utility.
 *
 * Server DB (SiteSetting table) is the SOURCE OF TRUTH.
 * localStorage is a local cache for instant reads.
 *
 * SAVE: localStorage (immediate for UX) → server (debounced with retry)
 * LOAD: server first → localStorage cache (fallback if server unreachable)
 */

const SYNC_DEBOUNCE_MS = 1000;
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingValues = new Map<string, { key: string; value: string }>();

/** Send a setting to the server with retry. Returns true on success. */
async function sendToServer(key: string, value: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) return true;
      if (res.status === 401 || res.status === 403) return false; // don't retry auth errors
    } catch {
      // network error — retry
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  console.warn(`[dev-settings] Failed to save "${key}" after 3 attempts`);
  return false;
}

/** Immediately flush a pending sync for a given key (used on page unload). */
function flushSync(key: string): void {
  const timer = pendingTimers.get(key);
  if (timer) clearTimeout(timer);
  pendingTimers.delete(key);

  const pending = pendingValues.get(key);
  if (!pending) return;
  pendingValues.delete(key);

  // sendBeacon is the only reliable way to send data during page unload
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/admin/settings",
      new Blob([JSON.stringify({ key: pending.key, value: pending.value })], {
        type: "application/json",
      }),
    );
  }
}

/** Flush ALL pending syncs (called on beforeunload). */
function flushAllPending(): void {
  for (const key of [...pendingValues.keys()]) {
    flushSync(key);
  }
}

// Register unload handler once
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushAllPending);
}

/**
 * Save a dev setting: localStorage (instant) + server (debounced with retry).
 * This is the PRIMARY save function — use this in all dev editors.
 */
export function saveDevSetting(key: string, value: string): void {
  localStorage.setItem(key, value);
  syncToServer(key, value);
}

/**
 * Save a dev setting immediately (no debounce). Use for explicit "Save" clicks.
 * Returns true if the server accepted the write.
 */
export async function saveDevSettingImmediate(key: string, value: string): Promise<boolean> {
  const timer = pendingTimers.get(key);
  if (timer) clearTimeout(timer);
  pendingTimers.delete(key);
  pendingValues.delete(key);

  localStorage.setItem(key, value);
  return sendToServer(key, value);
}

/** Debounced server sync (internal). */
function syncToServer(key: string, value: string): void {
  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);

  pendingValues.set(key, { key, value });

  pendingTimers.set(
    key,
    setTimeout(() => {
      pendingTimers.delete(key);
      pendingValues.delete(key);
      sendToServer(key, value);
    }, SYNC_DEBOUNCE_MS),
  );
}

/** @deprecated Use saveDevSetting instead. Kept for backward compatibility. */
export function syncSettingToServer(key: string, value: string): void {
  syncToServer(key, value);
}

/**
 * Load a dev setting from the server (source of truth).
 * Caches to localStorage on success. Falls back to localStorage if server is unreachable.
 */
export async function loadSettingFromServer(key: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, {
      cache: "no-store",
    });
    if (!res.ok) return localStorage.getItem(key);
    const data = (await res.json()) as { value: string | null };
    if (data.value != null) {
      localStorage.setItem(key, data.value);
      return data.value;
    }
  } catch {
    return localStorage.getItem(key);
  }
  return null;
}

/** All dev-setting localStorage keys that should be synced to the server. */
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

/** Load ALL dev settings from the server into localStorage. Returns when done. */
export async function loadAllDevSettingsFromServer(): Promise<void> {
  await Promise.all(DEV_SETTING_KEYS.map((key) => loadSettingFromServer(key)));
}

/**
 * Auto-heal: after loading from server, check if localStorage has data that
 * the server is missing. If so, push localStorage → server.
 * Call this after `loadSettingFromServer` or `Promise.all(...)` completes.
 *
 * @param results - array of [key, serverValue] pairs from loadSettingFromServer
 */
export function autoHealSettings(results: Array<[string, string | null]>): void {
  for (const [key, serverValue] of results) {
    if (serverValue != null) continue; // server already has it
    const local = localStorage.getItem(key);
    if (local != null && local !== "[]" && local !== "{}" && local !== "null") {
      syncToServer(key, local);
    }
  }
}
