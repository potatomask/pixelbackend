import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
  return null;
}

export async function GET(request: NextRequest) {
  const err = await requireAdmin();
  if (err) return err;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status && ["new", "reviewed", "resolved"].includes(status)) {
    where.status = status;
  }
  if (search) {
    where.user = {
      OR: [
        { handle: { contains: search } },
        { email: { contains: search } },
      ],
    };
  }

  const [feedbacks, total] = await Promise.all([
    prisma.cancelFeedback.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { handle: true, email: true, tier: true },
        },
      },
    }),
    prisma.cancelFeedback.count({ where }),
  ]);

  return NextResponse.json(
    { feedbacks, total, page, totalPages: Math.ceil(total / limit) },
    { headers: NO_STORE_HEADERS },
  );
}

export async function PATCH(request: NextRequest) {
  const err = await requireAdmin();
  if (err) return err;

  const body = await request.json();
  const { id, status } = body as { id: string; status: string };
  if (!id || !["new", "reviewed", "resolved"].includes(status)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  await prisma.cancelFeedback.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status } as any,
  });

  return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
}
