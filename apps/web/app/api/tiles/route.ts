import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { z } from "zod";

const TileSchema = z.object({
  id: z.number().int().min(1),
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  walkable: z.boolean(),
  tilesetSrc: z.string().nullable().optional(),
  srcX: z.number().int().min(0).default(0),
  srcY: z.number().int().min(0).default(0),
  tileCost: z.number().min(0).default(1),
  autoTile: z.boolean().default(false),
  zLayer: z.number().int().min(0).max(2).default(1),
});

// GET /api/tiles — List all tile definitions
export async function GET() {
  try {
    const rows = await prisma.tileDefinition.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({ tiles: rows });
  } catch {
    return NextResponse.json({ tiles: [] });
  }
}

// POST /api/tiles — Create a new tile definition (admin only)
export async function POST(request: NextRequest) {
  const error = await requireAdmin(request);
  if (error) return error;

  const body = await request.json();
  const parsed = TileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, name, color, walkable, tilesetSrc, srcX, srcY, tileCost, autoTile, zLayer } = parsed.data;

  const existing = await prisma.tileDefinition.findUnique({ where: { id } });
  if (existing) {
    return NextResponse.json({ error: "Tile ID already exists" }, { status: 409 });
  }

  const tile = await prisma.tileDefinition.create({
    data: { id, name, color, walkable, tilesetSrc: tilesetSrc ?? null, srcX, srcY, tileCost, autoTile, zLayer },
  });

  return NextResponse.json({ tile }, { status: 201 });
}
