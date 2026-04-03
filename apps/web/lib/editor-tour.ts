import { prisma } from "./prisma";

export const EDITOR_TOUR_SETTINGS_KEY = "editor-tour-completions";

export type EditorTourCompletionMap = Record<string, string>;

function normalizeEditorTourMap(value: unknown): EditorTourCompletionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (Array.isArray(value)) {
      return value.reduce<EditorTourCompletionMap>((acc, userId) => {
        if (typeof userId === "string" && userId) {
          acc[userId] = "";
        }
        return acc;
      }, {});
    }
    return {};
  }

  return Object.entries(value).reduce<EditorTourCompletionMap>((acc, [userId, completedAt]) => {
    if (typeof completedAt === "string") {
      acc[userId] = completedAt;
    }
    return acc;
  }, {});
}

export async function getEditorTourCompletionMap(): Promise<EditorTourCompletionMap> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: EDITOR_TOUR_SETTINGS_KEY } });
  if (!setting?.value) {
    return {};
  }

  try {
    return normalizeEditorTourMap(JSON.parse(setting.value));
  } catch {
    return {};
  }
}

async function saveEditorTourCompletionMap(map: EditorTourCompletionMap) {
  await prisma.siteSetting.upsert({
    where: { key: EDITOR_TOUR_SETTINGS_KEY },
    create: { key: EDITOR_TOUR_SETTINGS_KEY, value: JSON.stringify(map) },
    update: { value: JSON.stringify(map) },
  });
}

export async function getEditorTourCompletedAt(userId: string): Promise<string | null> {
  const map = await getEditorTourCompletionMap();
  return map[userId] ?? null;
}

export async function markEditorTourCompleted(userId: string): Promise<string> {
  const map = await getEditorTourCompletionMap();
  const completedAt = new Date().toISOString();
  map[userId] = completedAt;
  await saveEditorTourCompletionMap(map);
  return completedAt;
}

export async function resetEditorTour(userId: string) {
  const map = await getEditorTourCompletionMap();
  if (!(userId in map)) {
    return;
  }

  delete map[userId];
  await saveEditorTourCompletionMap(map);
}
