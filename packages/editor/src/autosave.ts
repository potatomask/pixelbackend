import { AUTOSAVE_DEBOUNCE_MS } from "@mypixelpage/shared";
import { useEditorStore } from "./store";

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start watching for dirty state and autosave draft.
 * Call on editor mount. Returns a cleanup function.
 */
export function startAutosave(saveFn: (worldData: unknown) => Promise<void>): () => void {
  const unsub = useEditorStore.subscribe((state, prevState) => {
    if (state.isDirty && !prevState.isDirty) {
      scheduleAutosave(saveFn);
    }
  });

  // Also handle beforeunload
  const onBeforeUnload = (e: BeforeUnloadEvent): void => {
    if (useEditorStore.getState().isDirty) {
      e.preventDefault();
    }
  };
  window.addEventListener("beforeunload", onBeforeUnload);

  return () => {
    unsub();
    window.removeEventListener("beforeunload", onBeforeUnload);
    if (autosaveTimer) clearTimeout(autosaveTimer);
  };
}

function scheduleAutosave(saveFn: (worldData: unknown) => Promise<void>): void {
  if (autosaveTimer) clearTimeout(autosaveTimer);

  autosaveTimer = setTimeout(async () => {
    const { isDirty, worldData, setSaving, markSaved } = useEditorStore.getState();
    if (!isDirty) return;

    setSaving(true);
    try {
      await saveFn(worldData);
      markSaved();
    } catch (err) {
      console.error("Autosave failed:", err);
      setSaving(false);
      // Retry after a longer delay
      scheduleAutosave(saveFn);
    }
  }, AUTOSAVE_DEBOUNCE_MS);
}
