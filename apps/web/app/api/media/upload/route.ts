import { type NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getStorageLimitForTier } from "@/lib/storage-limits";

export const runtime = "nodejs";

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
]);

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "video/quicktime": ".mov",
};

function sanitizeBaseName(filename: string): string {
  const rawBase = filename.replace(/\.[^.]+$/, "") || "upload";
  const cleaned = rawBase.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
  return cleaned || "upload";
}

function getMediaType(mimeType: string): "image" | "video" | null {
  if (IMAGE_MIME_TYPES.has(mimeType)) return "image";
  if (VIDEO_MIME_TYPES.has(mimeType)) return "video";
  return null;
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, tier: true, storageUsed: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const mediaType = getMediaType(file.type);
  if (!mediaType) {
    return NextResponse.json({ error: "Only image, GIF, and video uploads are supported" }, { status: 400 });
  }

  // Check storage limit
  const fileSize = file.size;
  const storageLimit = await getStorageLimitForTier(user.tier);
  if ((user!.storageUsed + fileSize) > storageLimit) {
    return NextResponse.json({ error: "Storage limit exceeded. Upgrade your plan for more space." }, { status: 413 });
  }

  const safeBaseName = sanitizeBaseName(file.name);
  const fallbackExt = mediaType === "image" ? ".png" : ".mp4";
  const preferredExt = MIME_EXTENSIONS[file.type] ?? (extname(file.name).toLowerCase() || fallbackExt);
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeBaseName}${preferredExt}`;
  const userDir = join(process.cwd(), "public", "uploads", user.id);
  const filePath = join(userDir, filename);

  await mkdir(userDir, { recursive: true });
  await writeFile(filePath, new Uint8Array(await file.arrayBuffer()));

  // Update storage used
  await prisma.user.update({
    where: { id: user!.id },
    data: { storageUsed: { increment: fileSize } },
  });

  return NextResponse.json({
    url: `/uploads/${user.id}/${filename}`,
    filename,
    mimeType: file.type,
    mediaType,
    ownerId: user.id,
  }, { status: 201 });
}