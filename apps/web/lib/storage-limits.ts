import { prisma } from "@/lib/prisma";
import {
  STORAGE_LIMITS_KEY,
  STORAGE_LIMITS,
  getStorageLimit as getStorageLimitFromConfig,
  normalizeStorageLimits,
  type StorageLimitConfig,
} from "@/lib/storage";

export async function getStorageLimits(): Promise<StorageLimitConfig> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: STORAGE_LIMITS_KEY } });
    if (!row?.value) return STORAGE_LIMITS;
    return normalizeStorageLimits(JSON.parse(row.value));
  } catch {
    return STORAGE_LIMITS;
  }
}

export async function getStorageLimitForTier(tier: string): Promise<number> {
  const limits = await getStorageLimits();
  return getStorageLimitFromConfig(tier, limits);
}
