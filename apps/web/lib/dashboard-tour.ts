import { prisma } from "./prisma";

export const DASHBOARD_TOUR_SETTINGS_KEY = "dashboard-tour-completions";

export type DashboardTourCompletionMap = Record<string, string>;

function normalizeDashboardTourMap(value: unknown): DashboardTourCompletionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (Array.isArray(value)) {
      return value.reduce<DashboardTourCompletionMap>((acc, userId) => {
        if (typeof userId === "string" && userId) {
          acc[userId] = "";
        }
        return acc;
      }, {});
    }
    return {};
  }

  return Object.entries(value).reduce<DashboardTourCompletionMap>((acc, [userId, completedAt]) => {
    if (typeof completedAt === "string") {
      acc[userId] = completedAt;
    }
    return acc;
  }, {});
}

export async function getDashboardTourCompletionMap(): Promise<DashboardTourCompletionMap> {
  const setting = await prisma.siteSetting.findUnique({ where: { key: DASHBOARD_TOUR_SETTINGS_KEY } });
  if (!setting?.value) {
    return {};
  }

  try {
    return normalizeDashboardTourMap(JSON.parse(setting.value));
  } catch {
    return {};
  }
}

async function saveDashboardTourCompletionMap(map: DashboardTourCompletionMap) {
  await prisma.siteSetting.upsert({
    where: { key: DASHBOARD_TOUR_SETTINGS_KEY },
    create: { key: DASHBOARD_TOUR_SETTINGS_KEY, value: JSON.stringify(map) },
    update: { value: JSON.stringify(map) },
  });
}

export async function getDashboardTourCompletedAt(userId: string): Promise<string | null> {
  const map = await getDashboardTourCompletionMap();
  return map[userId] ?? null;
}

export async function markDashboardTourCompleted(userId: string): Promise<string> {
  const map = await getDashboardTourCompletionMap();
  const completedAt = new Date().toISOString();
  map[userId] = completedAt;
  await saveDashboardTourCompletionMap(map);
  return completedAt;
}

export async function resetDashboardTour(userId: string) {
  const map = await getDashboardTourCompletionMap();
  if (!(userId in map)) {
    return;
  }

  delete map[userId];
  await saveDashboardTourCompletionMap(map);
}