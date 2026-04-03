import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } });
  if (!user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE });
  return null;
}

export async function GET(request: NextRequest) {
  const err = await requireAdmin();
  if (err) return err;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));
  const search = url.searchParams.get("search") ?? "";
  const skip = (page - 1) * limit;

  const where = search
    ? {
        user: {
          OR: [
            { handle: { contains: search } },
            { email: { contains: search } },
          ],
        },
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.onboarding.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        source: true,
        sourceOther: true,
        useCase: true,
        useCaseOther: true,
        createdAt: true,
        user: {
          select: { id: true, handle: true, email: true, image: true },
        },
      },
    }),
    prisma.onboarding.count({ where }),
  ]);

  return NextResponse.json({ rows, total, page, totalPages: Math.ceil(total / limit) }, { headers: NO_STORE });
}
