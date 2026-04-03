import { Creem } from "creem";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY!,
  serverIdx: process.env.CREEM_API_KEY?.startsWith("creem_test_") ? 1 : 0,
});

// GET /api/creem/portal - Create/get a customer portal session URL
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { id: true, email: true, creemCustomerId: true },
  });

  if (!dbUser?.creemCustomerId) {
    // Try to find customer by email
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customer = await creem.customers.retrieve(undefined, dbUser?.email) as any;
      if (!customer?.id) {
        return NextResponse.json({ error: "No subscription found" }, { status: 404 });
      }
      // Store for future use
      if (dbUser && !dbUser.creemCustomerId) {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { creemCustomerId: customer.id },
        });
      }
      const billingLinks = await creem.customers.generateBillingLinks({ customerId: customer.id });
      return NextResponse.json({ portalUrl: billingLinks.customerPortalLink });
    } catch {
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }
  }

  try {
    const billingLinks = await creem.customers.generateBillingLinks({
      customerId: dbUser.creemCustomerId,
    });
    return NextResponse.json({ portalUrl: billingLinks.customerPortalLink });
  } catch (err) {
    console.error("Creem portal error:", err);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
