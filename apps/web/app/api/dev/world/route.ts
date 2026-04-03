import { type NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { WorldDataSchema } from "@mypixelpage/shared";
import { getAuthUser, requireAdmin } from "@/lib/auth-utils";

const DATA_DIR = path.join(process.cwd(), "data");
const WORLD_FILE = path.join(DATA_DIR, "dev-world.json");

// GET /api/dev/world — Load dev world from file (any authenticated user, for migration)
export async function GET(request: NextRequest) {
  const { error } = await getAuthUser(request);
  if (error) return error;

  try {
    const raw = await fs.readFile(WORLD_FILE, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json({ worldData: data });
  } catch {
    return NextResponse.json({ worldData: null });
  }
}

// PUT /api/dev/world — Save dev world to file (admin only)
export async function PUT(request: NextRequest) {
  const error = await requireAdmin(request);
  if (error) return error;

  const body = await request.json();
  const parsed = WorldDataSchema.safeParse(body.worldData);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid world data" }, { status: 400 });
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(WORLD_FILE, JSON.stringify(parsed.data, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
