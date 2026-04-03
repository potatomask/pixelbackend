import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, requireAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

// GET /api/admin/settings?key=xxx — admin only
export async function GET(request: NextRequest) {
  const error = await requireAdmin(request);
  if (error) return error;

  const key = request.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  const setting = await prisma.siteSetting.findUnique({ where: { key } });
  return NextResponse.json({ value: setting?.value ?? null });
}

// PUT /api/admin/settings  body: { key: string; value: unknown }
export async function PUT(request: NextRequest) {
  const error = await requireAdmin(request);
  if (error) return error;

  const body = await request.json() as { key?: string; value?: unknown };
  const { key, value } = body;
  if (!key || value === undefined) {
    return NextResponse.json({ error: "key and value required" }, { status: 400 });
  }

  const serialized = typeof value === "string" ? value : JSON.stringify(value);

  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: serialized },
    update: { value: serialized },
  });

  return NextResponse.json({ ok: true });
}
