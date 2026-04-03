import { Creem } from "creem";
import { prisma } from "@/lib/prisma";

const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY!,
  serverIdx: process.env.CREEM_API_KEY?.startsWith("creem_test_") ? 1 : 0,
});

/**
 * Check all active subscriptions and downgrade expired ones.
 * Should be called by a daily cron job.
 */
export async function syncExpiredSubscriptions(): Promise<{ checked: number; expired: number }> {
  const now = new Date();

  // Find all users who might have an active paid subscription
  const usersWithSubs = await prisma.user.findMany({
    where: {
      tier: { in: ["STARTER", "PRO"] },
      creemSubscriptionId: { not: null },
    },
    select: {
      id: true,
      email: true,
      tier: true,
      creemSubscriptionId: true,
    },
  });

  let expired = 0;

  for (const user of usersWithSubs) {
    if (!user.creemSubscriptionId) continue;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = await creem.subscriptions.get(user.creemSubscriptionId) as any;
      const status = sub.status as string;
      const currentPeriodEnd = sub.currentPeriodEndDate as string | null;
      const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;

      // If period has ended or subscription is expired, downgrade
      const hasExpired = status === "expired" || (periodEnd && periodEnd < now);

      if (hasExpired) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: "FREE",
            creemSubscriptionId: null,
            tierExpiresAt: null,
          },
        });
        expired++;
        console.log(`[cron] Downgraded user ${user.id} (${user.email}) — subscription ${status} / period ended ${currentPeriodEnd}`);
      }
    } catch (err) {
      // Subscription not found in Creem — assume expired
      if ((err as { code?: string }).code === "NOT_FOUND" || (err as Error).message?.includes("not found")) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            tier: "FREE",
            creemSubscriptionId: null,
            tierExpiresAt: null,
          },
        });
        expired++;
        console.log(`[cron] Downgraded user ${user.id} (${user.email}) — subscription not found in Creem`);
      } else {
        console.error(`[cron] Error checking subscription for user ${user.id}:`, err);
      }
    }
  }

  return { checked: usersWithSubs.length, expired };
}
