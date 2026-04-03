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

/** Verify the request is from an admin. Returns null if ok, or a 401/403 response. */
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

export async function GET(_request: NextRequest) {
  const err = await requireAdmin();
  if (err) return err;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Aggregate stats
  const [totalUsers, tierCounts, totalWorlds, publishedWorlds, recentUsers] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ["tier"], _count: true }),
      prisma.world.count(),
      prisma.world.count({ where: { isPublished: true } }),
      prisma.user.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, tier: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const tiers: Record<string, number> = { FREE: 0, STARTER: 0, PRO: 0, TESTER: 0 };
  for (const t of tierCounts) tiers[t.tier] = t._count;

  // Build daily signup series for last 30 days
  const dailySignups: { date: string; count: number; free: number; starter: number; pro: number; tester: number }[] = [];
  const dayMap = new Map<string, { count: number; free: number; starter: number; pro: number; tester: number }>();
  for (let d = 0; d < 30; d++) {
    const date = new Date(thirtyDaysAgo.getTime() + d * 24 * 60 * 60 * 1000);
    const key = date.toISOString().slice(0, 10);
    dayMap.set(key, { count: 0, free: 0, starter: 0, pro: 0, tester: 0 });
  }
  for (const u of recentUsers) {
    const key = u.createdAt.toISOString().slice(0, 10);
    const entry = dayMap.get(key);
    if (entry) {
      entry.count++;
      if (u.tier === "FREE") entry.free++;
      else if (u.tier === "STARTER") entry.starter++;
      else if (u.tier === "PRO") entry.pro++;
      else if (u.tier === "TESTER") entry.tester++;
    }
  }
  for (const [date, data] of dayMap) {
    dailySignups.push({ date, ...data });
  }
  dailySignups.sort((a, b) => a.date.localeCompare(b.date));

  // Recent signups for ticker
  const latestUsers = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { handle: true, tier: true, createdAt: true },
  });

  return NextResponse.json(
    {
      totalUsers,
      tiers,
      totalWorlds,
      publishedWorlds,
      dailySignups,
      latestUsers,
      paidUsers: (tiers.STARTER ?? 0) + (tiers.PRO ?? 0),
      newUsersThisMonth: recentUsers.length,
    },
    { headers: NO_STORE_HEADERS },
  );
}
