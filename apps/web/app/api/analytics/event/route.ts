import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AnalyticsEventSchema } from "@mypixelpage/shared";

// Simple in-memory rate limiter: key → { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;  // per IP per minute

function rateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

// POST /api/analytics/event — Track an analytics event (rate-limited, no auth required)
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json();
  const parsed = AnalyticsEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  // Fire and forget — don't await for client
  prisma.analyticsEvent
    .create({
      data: {
        worldId: parsed.data.worldId,
        eventType: parsed.data.eventType,
        objectId: parsed.data.objectId ?? null,
        deviceType: parsed.data.deviceType,
      },
    })
    .catch((err) => console.error("Analytics insert failed:", err));

  return new NextResponse(null, { status: 202 });
}
