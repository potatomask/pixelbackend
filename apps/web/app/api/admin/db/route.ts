import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_MODELS = [
  "user",
  "session",
  "account",
  "verification",
  "world",
  "cancelFeedback",
  "feedback",
  "statsSnapshot",
] as const;

type ModelName = (typeof ALLOWED_MODELS)[number];

function isValidModel(name: string): name is ModelName {
  return ALLOWED_MODELS.includes(name as ModelName);
}

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

/** GET /api/admin/db — list tables or records */
export async function GET(request: NextRequest) {
  const err = await requireAdmin();
  if (err) return err;

  const url = new URL(request.url);
  const table = url.searchParams.get("table");

  // List all tables with row counts
  if (!table) {
    const counts = await Promise.all(
      ALLOWED_MODELS.map(async (model) => {
        const count = await (prisma as any)[model].count();
        return { name: model, count };
      }),
    );
    return NextResponse.json({ tables: counts });
  }

  if (!isValidModel(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "25", 10)));
  const skip = (page - 1) * limit;
  const search = url.searchParams.get("search") ?? "";

  // Build where clause for search
  let where: any = {};
  if (search) {
    // Search across string fields — we'll search common fields
    const searchFilters: any[] = [];
    // Try common string fields
    for (const field of ["email", "handle", "name", "displayName", "slug", "reason", "message", "identifier", "providerId"]) {
      searchFilters.push({ [field]: { contains: search } });
    }
    // Use OR with a try/catch approach — Prisma will ignore invalid fields
    where = { OR: searchFilters };
  }

  try {
    const [records, total] = await Promise.all([
      (prisma as any)[table].findMany({
        where: search ? where : undefined,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      (prisma as any)[table].count({
        where: search ? where : undefined,
      }),
    ]);

    return NextResponse.json({
      records,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch {
    // If search filter has invalid fields, retry without search
    const [records, total] = await Promise.all([
      (prisma as any)[table].findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      (prisma as any)[table].count(),
    ]);

    return NextResponse.json({
      records,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  }
}

/** PUT /api/admin/db — update a record */
export async function PUT(request: NextRequest) {
  const err = await requireAdmin();
  if (err) return err;

  const body = await request.json();
  const { table, id, data } = body;

  if (!table || !id || !data || typeof data !== "object") {
    return NextResponse.json({ error: "Missing table, id, or data" }, { status: 400 });
  }

  if (!isValidModel(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  // Don't allow modifying id or relations
  const safeData = { ...data };
  delete safeData.id;
  delete safeData.sessions;
  delete safeData.accounts;
  delete safeData.worlds;
  delete safeData.cancelFeedback;
  delete safeData.feedbacks;
  delete safeData.user;

  try {
    const updated = await (prisma as any)[table].update({
      where: { id },
      data: safeData,
    });
    return NextResponse.json({ record: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Update failed" }, { status: 400 });
  }
}

/** DELETE /api/admin/db — delete a record */
export async function DELETE(request: NextRequest) {
  const err = await requireAdmin();
  if (err) return err;

  const url = new URL(request.url);
  const table = url.searchParams.get("table");
  const id = url.searchParams.get("id");

  if (!table || !id) {
    return NextResponse.json({ error: "Missing table or id" }, { status: 400 });
  }

  if (!isValidModel(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  try {
    await (prisma as any)[table].delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Delete failed" }, { status: 400 });
  }
}
