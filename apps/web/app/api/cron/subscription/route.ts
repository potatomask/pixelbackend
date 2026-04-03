import { type NextRequest, NextResponse } from "next/server";
import { syncExpiredSubscriptions } from "@/lib/creem-cron";

// Cron route — call this daily to sync expired subscriptions
// Protected by CRON_SECRET and Vercel's cron headers
export async function GET(request: NextRequest) {
  // Verify cron secret from environment
  const cronSecret = request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Vercel Cron injects this header
  const vercelCron = request.headers.get("x-vercel-cron");
  if (!vercelCron && !process.env.CRON_SECRET) {
    // Allow local testing without auth
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncExpiredSubscriptions();
    return NextResponse.json({
      ok: true,
      message: `Checked ${result.checked} subscriptions, downgraded ${result.expired}`,
      checked: result.checked,
      expired: result.expired,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron] Failed:", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
