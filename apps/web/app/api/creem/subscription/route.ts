import { Creem } from "creem";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY!,
  serverIdx: process.env.CREEM_API_KEY?.startsWith("creem_test_") ? 1 : 0,
});

// GET /api/creem/subscription - Get user's subscription status
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: {
      creemCustomerId: true,
      creemSubscriptionId: true,
      tier: true,
      tierExpiresAt: true,
      subscriptionStatus: true,
    },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!dbUser.creemSubscriptionId) {
    return NextResponse.json({
      hasSubscription: false,
      tier: dbUser.tier,
      status: null,
      currentPeriodEnd: dbUser.tierExpiresAt ? dbUser.tierExpiresAt.toISOString() : null,
      cancelAtPeriodEnd: false,
      subscriptionStatus: dbUser.subscriptionStatus ?? "none",
      creemCustomerId: dbUser.creemCustomerId,
    });
  }

  try {
    const subscription = await creem.subscriptions.get(dbUser.creemSubscriptionId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subAny = subscription as any;
    const status = subAny.status as string;
    const productId = subAny.product?.id ?? subAny.product ?? null;
    const currentPeriodEnd = subAny.currentPeriodEndDate as string | null;
    const cancelAtPeriodEnd = subAny.cancelAtPeriodEnd as boolean;

    // Check if subscription period has ended (even if Creem status hasn't updated yet)
    const now = new Date();
    const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
    const hasPeriodEnded = periodEnd && periodEnd < now;

    // If period has ended or subscription is expired, downgrade immediately
    if (hasPeriodEnded || status === "expired") {
      await prisma.user.update({
        where: { id: user!.id },
        data: {
          tier: "FREE",
          creemSubscriptionId: null,
          tierExpiresAt: null,
        },
      });

      return NextResponse.json({
        hasSubscription: false,
        subscriptionId: null,
        status: "expired",
        productId: null,
        currentPeriodEnd: currentPeriodEnd ?? (dbUser.tierExpiresAt ? dbUser.tierExpiresAt.toISOString() : null),
        cancelAtPeriodEnd: false,
        tier: "FREE",
        subscriptionStatus: "canceled",
        creemCustomerId: dbUser.creemCustomerId,
      });
    }

    const isActive = status === "active" || status === "trialing";

    // Determine subscriptionStatus from Creem's status
    let subscriptionStatus: "none" | "active" | "canceled" = "active";
    if (status === "scheduled_cancel" || status === "canceled") {
      subscriptionStatus = "canceled";
    } else if (isActive || status === "past_due") {
      subscriptionStatus = "active";
    } else {
      subscriptionStatus = "none";
    }

    return NextResponse.json({
      hasSubscription: isActive || status === "past_due",
      subscriptionId: subscription.id,
      status,
      productId,
      currentPeriodEnd: currentPeriodEnd ?? (dbUser.tierExpiresAt ? dbUser.tierExpiresAt.toISOString() : null),
      cancelAtPeriodEnd,
      tier: dbUser.tier,
      subscriptionStatus,
      creemCustomerId: dbUser.creemCustomerId,
    });
  } catch (err) {
    console.error("Creem subscription fetch error:", err);

    // If Creem API fails, check if local tier has already expired
    if (dbUser.tierExpiresAt && new Date(dbUser.tierExpiresAt) < new Date()) {
      await prisma.user.update({
        where: { id: user!.id },
        data: {
          tier: "FREE",
          creemSubscriptionId: null,
          tierExpiresAt: null,
        },
      });

      return NextResponse.json({
        hasSubscription: false,
        subscriptionId: null,
        status: "expired",
        productId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        tier: "FREE",
        subscriptionStatus: "canceled",
        creemCustomerId: dbUser.creemCustomerId,
      });
    }

    const responseData = {
      hasSubscription: false,
      tier: dbUser.tier,
      status: "not_found",
      currentPeriodEnd: dbUser.tierExpiresAt ? dbUser.tierExpiresAt.toISOString() : null,
      cancelAtPeriodEnd: false,
      subscriptionStatus: dbUser.subscriptionStatus ?? "none",
      creemCustomerId: dbUser.creemCustomerId,
    };
    return NextResponse.json(responseData);
  }
}
