import { Webhook } from "@creem_io/nextjs";
import { Creem } from "creem";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY!,
  serverIdx: process.env.CREEM_API_KEY?.startsWith("creem_test_") ? 1 : 0,
});

async function resolveWebhookUser({
  userId,
  customerId,
  customerEmail,
}: {
  userId?: string;
  customerId?: string;
  customerEmail?: string;
}): Promise<User | null> {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) return user;
  }

  if (customerId) {
    const user = await prisma.user.findFirst({ where: { creemCustomerId: customerId } });
    if (user) return user;
  }

  if (customerEmail) {
    const user = await prisma.user.findUnique({ where: { email: customerEmail } });
    if (user) return user;
  }

  return null;
}

export const POST = Webhook({
  webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  onCheckoutCompleted: async ({ customer, product, metadata }) => {
    console.log("[webhook] checkout.completed", {
      customerEmail: customer?.email,
      customerId: customer?.id,
      productId: product?.id,
      metadata,
    });

    if (!customer?.email || !product?.id) {
      console.log("[webhook] checkout.completed — missing customer email or product id, skipping");
      return;
    }

    const tier = mapProductToTier(product.id);
    console.log("[webhook] checkout.completed — mapped tier:", tier, "for product:", product.id);

    if (!tier) {
      console.log("[webhook] checkout.completed — unrecognized product, skipping");
      return;
    }

    const userId = metadata?.referenceId as string | undefined;
    const user = await resolveWebhookUser({
      userId,
      customerId: customer.id,
      customerEmail: customer.email,
    });

    if (!user) {
      console.log("[webhook] checkout.completed — no user mapping found, skipping");
      return;
    }

    const updateData: Record<string, unknown> = { tier, subscriptionStatus: "active" };

    if (customer.id) {
      updateData.creemCustomerId = customer.id;
    }

    if (!user.paidSince) {
      updateData.paidSince = new Date();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    console.log("[webhook] checkout.completed — updated user tier to:", tier);
  },
  onSubscriptionActive: async ({ customer, ...sub }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = sub as any;
    console.log("[webhook] subscription.active", {
      customerEmail: customer?.email,
      customerId: customer?.id,
      subscriptionId: subscription.id,
      product: subscription.product,
      status: subscription.status,
      currentPeriodStartDate: subscription.currentPeriodStartDate,
      currentPeriodEndDate: subscription.currentPeriodEndDate,
      periodStartDate: subscription.periodStartDate,
      periodEndDate: subscription.periodEndDate,
      createdAt: subscription.createdAt,
      rawKeys: Object.keys(subscription),
    });

    if (!customer?.email && !customer?.id) {
      console.log("[webhook] subscription.active — no customer identifiers, skipping");
      return;
    }

    const user = await resolveWebhookUser({
      customerId: customer?.id,
      customerEmail: customer?.email,
    });
    if (!user) {
      console.log("[webhook] subscription.active — user mapping not found");
      return;
    }

    // Get product ID — could be { id: "..." } or just the string
    const productId = typeof subscription.product === "object"
      ? (subscription.product?.id ?? subscription.product)
      : subscription.product;

    console.log("[webhook] subscription.active — productId extracted:", productId);
    console.log("[webhook] subscription.active — CREEM_STARTER_PRODUCT_ID:", process.env.CREEM_STARTER_PRODUCT_ID);
    console.log("[webhook] subscription.active — CREEM_PRO_PRODUCT_ID:", process.env.CREEM_PRO_PRODUCT_ID);

    const tier = productId ? mapProductToTier(productId) : null;
    console.log("[webhook] subscription.active — mapped tier:", tier);

    // Extract real dates from Creem
    const periodStart = subscription.currentPeriodStartDate ?? subscription.periodStartDate ?? null;
    const periodEnd = subscription.currentPeriodEndDate ?? subscription.periodEndDate ?? null;

    // Always store the subscription ID and real dates
    const updateData: Record<string, unknown> = {
      paidSince: periodStart ? new Date(periodStart) : (user.paidSince ?? new Date()),
      tierExpiresAt: periodEnd ? new Date(periodEnd) : null,
      subscriptionStatus: "active",
    };

    if (subscription.id) {
      updateData.creemSubscriptionId = subscription.id;
    }

    if (customer?.id && !user.creemCustomerId) {
      updateData.creemCustomerId = customer.id;
    }

    // Only update tier if we recognize the product
    if (tier) {
      updateData.tier = tier;
    } else {
      console.log("[webhook] subscription.active — unrecognized product:", productId, ", NOT updating tier");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    console.log("[webhook] subscription.active — updated user tier to:", tier ?? "(unchanged, product not recognized)");
  },
  onSubscriptionCanceled: async ({ customer, ...sub }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webhookSub = sub as any;
    const subId = webhookSub.id ?? null;
    console.log("[webhook] subscription.canceled", {
      customerEmail: customer?.email,
      subscriptionId: subId,
      cancelAtPeriodEnd: webhookSub.cancelAtPeriodEnd,
      currentPeriodEndDate: webhookSub.currentPeriodEndDate,
      periodEnd: webhookSub.periodEnd,
      current_period_end_date: webhookSub.current_period_end_date,
      rawKeys: Object.keys(webhookSub),
    });

    if (!customer?.email && !customer?.id) return;
    const user = await resolveWebhookUser({
      customerId: customer?.id,
      customerEmail: customer?.email,
    });
    if (!user) return;

    // Try to get currentPeriodEndDate from Creem API (webhook payload may not have it)
    let currentPeriodEndDate: Date | null = null;
    let cancelAtPeriodEnd = webhookSub.cancelAtPeriodEnd;

    if (subId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const creemSub = await creem.subscriptions.get(subId) as any;
        const endDate = creemSub.currentPeriodEndDate ?? creemSub.current_period_end_date;
        currentPeriodEndDate = endDate ? new Date(endDate) : null;
        cancelAtPeriodEnd = creemSub.cancelAtPeriodEnd ?? cancelAtPeriodEnd;
        console.log("[webhook] subscription.canceled — fetched from Creem:", {
          cancelAtPeriodEnd,
          currentPeriodEndDate,
          endDate,
        });
      } catch (err) {
        console.log("[webhook] subscription.canceled — failed to fetch from Creem:", err);
      }
    }

    if (cancelAtPeriodEnd || currentPeriodEndDate) {
      // Scheduled cancel — keep subscriptionId so resume works later
      await prisma.user.update({
        where: { id: user.id },
        data: { tierExpiresAt: currentPeriodEndDate, subscriptionStatus: "canceled" },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { tier: "FREE", creemSubscriptionId: null, tierExpiresAt: null, subscriptionStatus: "canceled" },
      });
    }
  },
  onSubscriptionExpired: async ({ customer }) => {
    console.log("[webhook] subscription.expired", { customerEmail: customer?.email });
    if (!customer?.email && !customer?.id) return;
    const user = await resolveWebhookUser({
      customerId: customer?.id,
      customerEmail: customer?.email,
    });
    if (!user) return;
    await prisma.user.update({
      where: { id: user.id },
      data: { tier: "FREE", creemSubscriptionId: null, tierExpiresAt: null, subscriptionStatus: "canceled" },
    });
  },
  onSubscriptionPastDue: async ({ customer }) => {
    console.log("[webhook] subscription.past_due", { customerEmail: customer?.email });
    if (!customer?.email && !customer?.id) return;
    const user = await resolveWebhookUser({
      customerId: customer?.id,
      customerEmail: customer?.email,
    });
    if (!user) return;
    await prisma.user.update({
      where: { id: user.id },
      data: { tierExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
  },
});

function mapProductToTier(productId: string): string | null {
  if (productId === process.env.CREEM_STARTER_PRODUCT_ID) return "STARTER";
  if (productId === process.env.CREEM_PRO_PRODUCT_ID) return "PRO";
  return null;
}
