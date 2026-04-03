import { type NextRequest, NextResponse } from "next/server";
import { unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await request.json();
  if (!filename || typeof filename !== "string") {
    return NextResponse.json({ error: "Missing filename" }, { status: 400 });
  }

  // Prevent path traversal
  const safeName = filename.replace(/[/\\]/g, "");
  if (safeName !== filename || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = join(process.cwd(), "public", "uploads", session.user.id, safeName);

  try {
    const info = await stat(filePath);
    await unlink(filePath);

    // Update storage used
    await prisma.user.update({
      where: { id: session.user.id },
      data: { storageUsed: { decrement: info.size } },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
