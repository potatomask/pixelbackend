import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ReportSchema } from "@mypixelpage/shared";
import { createHash } from "crypto";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/reports — Submit an abuse report (no auth, rate-limited by IP)
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`reports:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many reports. Please wait." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Hash the reporter IP for privacy
  const hashedIp = createHash("sha256").update(ip).digest("hex").slice(0, 16);

  await prisma.report.create({
    data: {
      worldId: parsed.data.worldId,
      reason: parsed.data.reason,
      reporterIp: hashedIp,
    },
  });

  return NextResponse.json({}, { status: 201 });
}
