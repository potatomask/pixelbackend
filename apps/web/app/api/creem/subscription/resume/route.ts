import { Creem } from "creem";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY!,
  serverIdx: process.env.CREEM_API_KEY?.startsWith("creem_test_") ? 1 : 0,
});

// POST /api/creem/subscription/resume - Reactivate a canceled subscription
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { email: true, creemCustomerId: true, creemSubscriptionId: true, subscriptionStatus: true },
  });

  if (!dbUser?.creemSubscriptionId && !dbUser?.creemCustomerId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  let subscriptionId = dbUser.creemSubscriptionId;

  // If no stored subscriptionId, fetch from Creem
  if (!subscriptionId && dbUser.creemCustomerId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customer = await creem.customers.retrieve(dbUser.creemCustomerId) as any;
      subscriptionId = customer?.subscriptions?.[0]?.id ?? null;
    } catch {
      // try by email
    }
  }

  if (!subscriptionId && dbUser.email) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customer = await creem.customers.retrieve(undefined, dbUser.email) as any;
      subscriptionId = customer?.subscriptions?.[0]?.id ?? null;
    } catch {
      // last resort
    }
  }

  if (!subscriptionId) {
    return NextResponse.json({ error: "No subscription found" }, { status: 404 });
  }

  // Fetch before state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let subBefore: any = null;
  try {
    subBefore = await creem.subscriptions.get(subscriptionId);
  } catch {
    // ok
  }

  // Resume
  let result;
  try {
    result = await creem.subscriptions.resume(subscriptionId);
  } catch (resumeErr) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rErr = resumeErr as any;
    console.error("[api/creem/subscription/resume] failed:", rErr?.body || rErr?.message);
    return NextResponse.json({ error: "Failed to resume subscription" }, { status: 500 });
  }

  // Fetch after state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let subAfter: any = null;
  try {
    subAfter = await creem.subscriptions.get(subscriptionId);
  } catch {
    // ok
  }

  const periodStart = subAfter?.currentPeriodStartDate ?? subBefore?.currentPeriodStartDate ?? null;
  const periodEnd = subAfter?.currentPeriodEndDate ?? subBefore?.currentPeriodEndDate ?? null;

  console.log("[api/creem/subscription/resume] resumed:", {
    subscriptionId,
    status: subAfter?.status,
    currentPeriodStartDate: periodStart,
    currentPeriodEndDate: periodEnd,
  });

  await prisma.user.update({
    where: { id: user!.id },
    data: {
      subscriptionStatus: "active",
      tierExpiresAt: null,
      paidSince: periodStart ? new Date(periodStart) : undefined,
    },
  });

  return NextResponse.json({ success: true });
}
