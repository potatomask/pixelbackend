import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";
import { z } from "zod";

const UpdateTileSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  walkable: z.boolean().optional(),
  tilesetSrc: z.string().nullable().optional(),
  srcX: z.number().int().min(0).optional(),
  srcY: z.number().int().min(0).optional(),
  tileCost: z.number().min(0).optional(),
  autoTile: z.boolean().optional(),
  zLayer: z.number().int().min(0).max(2).optional(),
});

// PUT /api/tiles/[tileId] — Update a tile definition (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tileId: string }> }
) {
  const error = await requireAdmin(request);
  if (error) return error;

  const { tileId } = await params;
  const id = parseInt(tileId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid tile ID" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = UpdateTileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await prisma.tileDefinition.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ tile: updated });
  } catch {
    return NextResponse.json({ error: "Tile not found" }, { status: 404 });
  }
}

// DELETE /api/tiles/[tileId] — Delete a tile definition (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tileId: string }> }
) {
  const error = await requireAdmin(request);
  if (error) return error;

  const { tileId } = await params;
  const id = parseInt(tileId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid tile ID" }, { status: 400 });
  }

  if (id === 0) {
    return NextResponse.json({ error: "Cannot delete the empty tile" }, { status: 400 });
  }

  try {
    await prisma.tileDefinition.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Tile not found" }, { status: 404 });
  }
}
