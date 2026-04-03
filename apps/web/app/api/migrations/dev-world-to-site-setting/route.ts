import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

// POST /api/migrations/dev-world-to-site-setting
// One-time migration: extract assets from dev-world.json and save to SiteSetting
// so all users can load them via GET /api/admin/settings

const DATA_DIR = path.join(process.cwd(), "data");
const WORLD_FILE = path.join(DATA_DIR, "dev-world.json");

export async function POST() {
  const error = await requireAdmin(new Headers());
  if (error) return error;

  try {
    const raw = await fs.readFile(WORLD_FILE, "utf-8");
    const data = JSON.parse(raw) as {
      assets?: {
        tiles?: unknown[];
        objects?: unknown[];
        animations?: unknown[];
        characterConfig?: unknown;
        tags?: unknown[];
        autotileCenterVariants?: unknown;
        autotileLinearMaps?: unknown;
      };
    };

    const assets = data.assets ?? {};
    const entries: { key: string; value: unknown }[] = [];

    if (assets.tiles?.length) {
      entries.push({ key: "dev-tiles", value: assets.tiles });
    }
    if (assets.objects?.length) {
      entries.push({ key: "dev-objects", value: assets.objects });
    }
    if (assets.animations?.length) {
      entries.push({ key: "dev-animations", value: assets.animations });
    }
    if (assets.characterConfig) {
      entries.push({ key: "dev-character-config", value: assets.characterConfig });
    }
    if (assets.tags?.length) {
      entries.push({ key: "dev-tag-rules", value: assets.tags });
    }
    if (assets.autotileCenterVariants) {
      entries.push({ key: "autotile-center-variants", value: assets.autotileCenterVariants });
    }
    if (assets.autotileLinearMaps) {
      entries.push({ key: "autotile-linear-maps", value: assets.autotileLinearMaps });
    }

    const results: { key: string; status: string }[] = [];

    for (const entry of entries) {
      const serialized = JSON.stringify(entry.value);
      await prisma.siteSetting.upsert({
        where: { key: entry.key },
        create: { key: entry.key, value: serialized },
        update: { value: serialized },
      });
      results.push({ key: entry.key, status: "upserted" });
    }

    return NextResponse.json({
      ok: true,
      migrated: results,
      note: "This is a one-time migration. After running, you can delete this endpoint.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Migration failed", detail: message }, { status: 500 });
  }
}
