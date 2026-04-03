/**
 * Utility for syncing /dev settings between localStorage and the server (SiteSetting table).
 * All /dev editors save to localStorage first, then debounce-sync to the server.
 * On page load, settings are fetched from the server and merged into localStorage.
 */

const SYNC_DEBOUNCE_MS = 1500;
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingValues = new Map<string, { key: string; value: string }>();

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

/** Save a dev setting to the server via /api/admin/settings (debounced). */
export function syncSettingToServer(key: string, value: string): void {
  const existing = pendingTimers.get(key);
  if (existing) clearTimeout(existing);

  // Track the latest value so we can flush it on unload
  pendingValues.set(key, { key, value });

  pendingTimers.set(
    key,
    setTimeout(() => {
      pendingTimers.delete(key);
      pendingValues.delete(key);
      fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      }).catch((err) => {
        console.warn(`[dev-settings-sync] Failed to sync "${key}":`, err);
      });
    }, SYNC_DEBOUNCE_MS),
  );
}

/** Load a dev setting from the server and write it to localStorage if it exists. */
export async function loadSettingFromServer(key: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/admin/settings?key=${encodeURIComponent(key)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { value: string | null };
    if (data.value != null) {
      localStorage.setItem(key, data.value);
      return data.value;
    }
  } catch {
    // Fall back to localStorage
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
      syncSettingToServer(key, local);
    }
  }
}
