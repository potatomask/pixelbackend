import { Creem } from "creem";
import { type NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-utils";

const creem = new Creem({
  apiKey: process.env.CREEM_API_KEY!,
  serverIdx: process.env.CREEM_API_KEY?.startsWith("creem_test_") ? 1 : 0,
});

function getSafeSuccessUrl(successUrl: string | undefined, appUrl: string): string {
  const fallbackUrl = `${appUrl}/dashboard/billing?success=true`;
  if (!successUrl) return fallbackUrl;

  try {
    const appBase = new URL(appUrl);
    const candidate = new URL(successUrl, appBase);
    if (candidate.origin !== appBase.origin) {
      return fallbackUrl;
    }
    return candidate.toString();
  } catch {
    return fallbackUrl;
  }
}

// POST /api/creem/checkout - Create a checkout session
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json();
  const { productId, successUrl } = body as {
    productId: string;
    successUrl?: string;
  };

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  // Validate product ID matches allowed products
  const allowedProducts = [
    process.env.CREEM_STARTER_PRODUCT_ID,
    process.env.CREEM_PRO_PRODUCT_ID,
  ];
  if (!allowedProducts.includes(productId)) {
    return NextResponse.json({ error: "Invalid product ID" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const safeSuccessUrl = getSafeSuccessUrl(successUrl, appUrl);

  try {
    const checkout = await creem.checkouts.create({
      productId,
      customer: {
        email: user!.email,
      },
      successUrl: safeSuccessUrl,
      metadata: {
        referenceId: user!.id, // Used in webhooks to identify the user
        userId: user!.id,
        userEmail: user!.email,
      },
    });

    return NextResponse.json({ checkoutUrl: checkout.checkoutUrl, checkoutId: checkout.id });
  } catch (err) {
    console.error("Creem checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
