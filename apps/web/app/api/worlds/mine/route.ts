import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-utils";
import { WorldDataSchema, createEmptyWorldData } from "@mypixelpage/shared";

// GET /api/worlds/mine — Get the creator's world (auto-creates if missing)
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  let world = await prisma.world.findFirst({
    where: { ownerId: user!.id },
    select: {
      id: true,
      slug: true,
      width: true,
      height: true,
      tileSize: true,
      draftData: true,
      isPublished: true,
      publishedAt: true,
      updatedAt: true,
    },
  });

  // Auto-create if missing
  if (!world) {
    const dbUser = await prisma.user.findUnique({ where: { id: user!.id }, select: { handle: true } });
    const slug = dbUser?.handle || user!.id;
    const emptyData = createEmptyWorldData();
    const created = await prisma.world.create({
      data: {
        ownerId: user!.id,
        slug,
        width: emptyData.gridWidth,
        height: emptyData.gridHeight,
        draftData: JSON.stringify(emptyData),
      },
    });
    world = {
      id: created.id,
      slug: created.slug,
      width: created.width,
      height: created.height,
      tileSize: created.tileSize,
      draftData: created.draftData,
      isPublished: created.isPublished,
      publishedAt: created.publishedAt,
      updatedAt: created.updatedAt,
    };
  }

  return NextResponse.json(
    { world: { ...world, draftData: JSON.parse(world.draftData) } },
    { headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}

// PUT /api/worlds/mine — Save world data + auto-publish
const MAX_WORLD_SIZE = 5 * 1024 * 1024; // 5 MB max for world data

export async function PUT(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json();
  const parsed = WorldDataSchema.safeParse(body.worldData);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid world data" }, { status: 400 });
  }

  // Validate shape, but store the original to preserve any fields not in the schema yet
  const dataStr = JSON.stringify(body.worldData);
  if (dataStr.length > MAX_WORLD_SIZE) {
    return NextResponse.json({ error: "World data too large" }, { status: 413 });
  }

  const world = await prisma.world.findFirst({
    where: { ownerId: user!.id },
    select: { id: true },
  });

  if (!world) {
    return NextResponse.json({ error: "No world found" }, { status: 404 });
  }

  // Server-side credit enforcement: count placed items per category
  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { tier: true },
  });
  const userTier = (dbUser?.tier ?? "FREE") as "FREE" | "STARTER" | "PRO" | "TESTER";

  const [creditSetting, categorySetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: "dev-credit-config" } }),
    prisma.siteSetting.findUnique({ where: { key: "dev-categories" } }),
  ]);

  if (creditSetting?.value && categorySetting?.value) {
    try {
      const creditConfig = JSON.parse(creditSetting.value) as Record<string, Record<string, number>>;
      const categories = JSON.parse(categorySetting.value) as { id: string; items: string[] }[];
      const tierLimits = creditConfig[userTier] ?? {};
      const worldData = body.worldData as { layers?: number[][][]; objects?: { payload?: { kind?: string; objectDefId?: string } }[] };

      // Count usage per category
      const usage: Record<string, number> = {};
      const itemToCat = new Map<string, string>();
      for (const cat of categories) {
        for (const item of cat.items) {
          itemToCat.set(item, cat.id);
        }
      }

      // Count tiles
      if (worldData.layers) {
        for (const layer of worldData.layers) {
          for (const row of layer) {
            for (const cell of row) {
              if (cell === 0) continue;
              const catId = itemToCat.get(`tile:${cell}`);
              if (catId) usage[catId] = (usage[catId] ?? 0) + 1;
            }
          }
        }
      }

      // Count objects
      if (worldData.objects) {
        for (const obj of worldData.objects) {
          if (obj.payload?.kind === "custom" && obj.payload.objectDefId) {
            const catId = itemToCat.get(`object:${obj.payload.objectDefId}`);
            if (catId) usage[catId] = (usage[catId] ?? 0) + 1;
          }
        }
      }

      // Check limits (0 = unlimited)
      for (const [catId, limit] of Object.entries(tierLimits)) {
        if (limit > 0 && (usage[catId] ?? 0) > limit) {
          return NextResponse.json(
            { error: `Category limit exceeded for ${catId}` },
            { status: 403 },
          );
        }
      }
    } catch {
      // Don't block saves if credit config is malformed
    }
  }

  const now = new Date();

  // Save draft AND publish in one step
  await prisma.world.update({
    where: { id: world.id },
    data: {
      draftData: dataStr,
      publishedData: dataStr,
      isPublished: true,
      publishedAt: now,
    },
  });

  return NextResponse.json(
    { updatedAt: now.toISOString() },
    { headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}
