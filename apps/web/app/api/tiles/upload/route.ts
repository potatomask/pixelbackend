import { type NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { getAuthUser } from "@/lib/auth-utils";

const ALLOWED_TYPES = ["image/png"];
const MAX_SIZE = 512 * 1024; // 512 KB

// POST /api/tiles/upload — Upload a tileset PNG to public/tilesets/
export async function POST(request: NextRequest) {
  const { error } = await getAuthUser(request);
  if (error) return error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only PNG files are allowed" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 512KB)" }, { status: 400 });
  }

  // Sanitize filename: alphanumeric, hyphens, underscores only
  const rawName = file.name.replace(/\.png$/i, "");
  const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  if (!safeName) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filename = `${safeName}.png`;
  const tilesetDir = join(process.cwd(), "public", "tilesets");
  const filePath = join(tilesetDir, filename);

  // Don't overwrite existing to prevent accidental data loss
  if (existsSync(filePath)) {
    return NextResponse.json({ error: `File "${filename}" already exists` }, { status: 409 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  await writeFile(filePath, bytes);

  return NextResponse.json({
    url: `/tilesets/${filename}`,
    filename,
  }, { status: 201 });
}
