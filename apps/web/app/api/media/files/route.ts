import { type NextRequest, NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getStorageLimitForTier } from "@/lib/storage-limits";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
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

  const userDir = join(process.cwd(), "public", "uploads", user.id);
  const files: { name: string; url: string; size: number; createdAt: string }[] = [];

  try {
    const entries = await readdir(userDir);
    for (const name of entries) {
      const filePath = join(userDir, name);
      const info = await stat(filePath);
      if (info.isFile()) {
        files.push({
          name,
          url: `/uploads/${user.id}/${name}`,
          size: info.size,
          createdAt: info.birthtime.toISOString(),
        });
      }
    }
  } catch {
    // Directory doesn't exist yet — no files
  }

  files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const storageLimit = await getStorageLimitForTier(user.tier);
  const totalUsed = files.reduce((sum, f) => sum + f.size, 0);

  // Sync storageUsed in DB if it drifted
  if (totalUsed !== user.storageUsed) {
    await prisma.user.update({ where: { id: user.id }, data: { storageUsed: totalUsed } });
  }

  return NextResponse.json({
    files,
    storage: {
      used: totalUsed,
      limit: storageLimit,
      tier: user.tier,
    },
  });
}
