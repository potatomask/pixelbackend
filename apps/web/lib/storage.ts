import type { UserTier } from "@mypixelpage/shared";

const MB = 1024 * 1024;

export const STORAGE_LIMITS_KEY = "dev-storage-limits";

export type StorageLimitConfig = Record<UserTier, number>;

export const STORAGE_LIMITS: StorageLimitConfig = {
  FREE: 10 * MB,
  STARTER: 100 * MB,
  PRO: 300 * MB,
  TESTER: 1024 * MB,
};

export function normalizeStorageLimits(input: unknown): StorageLimitConfig {
  const parsed = (input ?? {}) as Partial<Record<UserTier, unknown>>;
  const sanitize = (v: unknown, fallback: number) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  return {
    FREE: sanitize(parsed.FREE, STORAGE_LIMITS.FREE),
    STARTER: sanitize(parsed.STARTER, STORAGE_LIMITS.STARTER),
    PRO: sanitize(parsed.PRO, STORAGE_LIMITS.PRO),
    TESTER: sanitize(parsed.TESTER, STORAGE_LIMITS.TESTER),
  };
}

export function getStorageLimit(tier: string, limits: Partial<Record<string, number>> = STORAGE_LIMITS): number {
  return limits[tier] ?? limits.FREE ?? STORAGE_LIMITS.FREE;
}

export function formatStorageLimitLabel(bytes: number): string {
  const mb = bytes / MB;
  const rounded = Number.isInteger(mb) ? mb.toFixed(0) : mb.toFixed(1);
  return `${rounded}MB storage`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
