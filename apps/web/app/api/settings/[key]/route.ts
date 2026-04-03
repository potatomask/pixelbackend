import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

const PUBLIC_SETTING_KEYS = new Set([
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
]);

// GET /api/settings/[key] — public for whitelisted keys, admin for all others
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  if (!PUBLIC_SETTING_KEYS.has(key)) {
    const error = await requireAdmin(request);
    if (error) return error;
  }

  const setting = await prisma.siteSetting.findUnique({ where: { key } });
  return NextResponse.json({ value: setting?.value ?? null });
}
