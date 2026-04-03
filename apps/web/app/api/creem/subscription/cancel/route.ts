import { Creem } from "creem";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY!,
  serverIdx: process.env.CREEM_API_KEY?.startsWith("creem_test_") ? 1 : 0,
});

// POST /api/creem/subscription/cancel - Schedule cancellation at period end
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { email: true, creemCustomerId: true, creemSubscriptionId: true, subscriptionStatus: true },
  });

  if (!dbUser?.creemSubscriptionId && !dbUser?.creemCustomerId) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
  }

  let subscriptionId = dbUser.creemSubscriptionId;

  // If no stored subscriptionId, fetch from Creem using customerId
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
    return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
  }

  // Fetch subscription to get current dates BEFORE canceling
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let subBefore: any = null;
  try {
    subBefore = await creem.subscriptions.get(subscriptionId);
  } catch (err) {
    console.error("[api/creem/subscription/cancel] failed to get subscription:", err);
  }

  console.log("[api/creem/subscription/cancel] subscription state before cancel:", {
    subscriptionId,
    status: subBefore?.status,
    currentPeriodStartDate: subBefore?.currentPeriodStartDate,
    currentPeriodEndDate: subBefore?.currentPeriodEndDate,
    cancelAtPeriodEnd: subBefore?.cancelAtPeriodEnd,
  });

  // Cancel the subscription
  let result;
  try {
    result = await creem.subscriptions.cancel(subscriptionId, { mode: "scheduled" });
  } catch (cancelErr) {
    // If already scheduled for cancellation, that's fine — proceed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cErr = cancelErr as any;
    if (cErr?.body?.includes("already scheduled")) {
      console.log("[api/creem/subscription/cancel] already scheduled, proceeding...");
    } else {
      console.error("[api/creem/subscription/cancel] cancel failed:", cErr?.body || cErr?.message);
      return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
    }
  }

  // Fetch subscription AFTER cancel to get accurate dates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let subAfter: any = null;
  try {
    subAfter = await creem.subscriptions.get(subscriptionId);
  } catch (err) {
    console.error("[api/creem/subscription/cancel] failed to get subscription after cancel:", err);
  }

  const periodStart = subAfter?.currentPeriodStartDate ?? subBefore?.currentPeriodStartDate ?? null;
  const periodEnd = subAfter?.currentPeriodEndDate ?? subBefore?.currentPeriodEndDate ?? null;

  console.log("[api/creem/subscription/cancel] after cancel:", {
    status: subAfter?.status,
    currentPeriodStartDate: periodStart,
    currentPeriodEndDate: periodEnd,
    cancelAtPeriodEnd: subAfter?.cancelAtPeriodEnd,
  });

  // Update DB
  await prisma.user.update({
    where: { id: user!.id },
    data: {
      subscriptionStatus: "canceled",
      creemSubscriptionId: subscriptionId,
      tierExpiresAt: periodEnd ? new Date(periodEnd) : null,
      paidSince: periodStart ? new Date(periodStart) : undefined,
    },
  });

  return NextResponse.json({ success: true });
}
