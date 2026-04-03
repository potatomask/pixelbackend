import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getDashboardTourCompletionMap, resetDashboardTour } from "@/lib/dashboard-tour";
import { getEditorTourCompletionMap, resetEditorTour } from "@/lib/editor-tour";
import { Creem } from "creem";

const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY!,
  serverIdx: process.env.CREEM_API_KEY?.startsWith("creem_test_") ? 1 : 0,
});

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const ADMIN_TIERS = ["FREE", "STARTER", "PRO", "TESTER"] as const;

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
  const tier = url.searchParams.get("tier");
  const search = url.searchParams.get("search");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (tier && (ADMIN_TIERS as readonly string[]).includes(tier)) {
    where.tier = tier;
  }
  if (search) {
    where.OR = [
      { handle: { contains: search } },
      { email: { contains: search } },
      { displayName: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        handle: true,
        displayName: true,
        image: true,
        tier: true,
        tierExpiresAt: true,
        paidSince: true,
        subscriptionStatus: true,
        isAdmin: true,
        createdAt: true,
        onboardedAt: true,
        creemSubscriptionId: true,
        _count: { select: { worlds: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const dashboardTourMap = await getDashboardTourCompletionMap();
  const editorTourMap = await getEditorTourCompletionMap();

  // Enrich with live Creem data for users with a subscription
  const enrichedUsers = await Promise.all(
    users.map(async (u) => {
      const dashboardTourCompletedAt = dashboardTourMap[u.id] ?? null;
      const editorTourCompletedAt = editorTourMap[u.id] ?? null;
      if (!u.creemSubscriptionId) return { ...u, dashboardTourCompletedAt, editorTourCompletedAt };
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = await creem.subscriptions.get(u.creemSubscriptionId) as any;
        const status = sub?.status as string;
        if (status === "active" || status === "trialing" || status === "past_due") {
          return { ...u, subscriptionStatus: "active" as const, dashboardTourCompletedAt, editorTourCompletedAt };
        }
        if (status === "scheduled_cancel" || status === "canceled") {
          return { ...u, subscriptionStatus: "canceled" as const, dashboardTourCompletedAt, editorTourCompletedAt };
        }
      } catch {
        // Creem lookup failed, keep DB value
      }
      return { ...u, dashboardTourCompletedAt, editorTourCompletedAt };
    })
  );

  return NextResponse.json(
    {
      users: enrichedUsers,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    },
    { headers: NO_STORE_HEADERS },
  );
}

export async function PATCH(request: NextRequest) {
  const err = await requireAdmin();
  if (err) return err;

  const body = await request.json();
  const { userId, tier, resetOnboarding, resetDashboardTour: shouldResetDashboardTour, resetEditorTour: shouldResetEditorTour } = body;

  if (!userId) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  // Reset onboarding: clear onboardedAt and delete onboarding record
  if (resetOnboarding === true) {
    await prisma.$transaction([
      prisma.onboarding.deleteMany({ where: { userId } }),
      prisma.user.update({ where: { id: userId }, data: { onboardedAt: null } }),
    ]);
    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  }

  if (shouldResetDashboardTour === true) {
    await resetDashboardTour(userId);
    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  }

  if (shouldResetEditorTour === true) {
    await resetEditorTour(userId);
    return NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });
  }

  if (!(ADMIN_TIERS as readonly string[]).includes(tier)) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400, headers: NO_STORE_HEADERS });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { tier },
    select: { id: true, tier: true },
  });

  return NextResponse.json(updated, { headers: NO_STORE_HEADERS });
}
