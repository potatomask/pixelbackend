import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const body = await request.json();
  const { reason, comment } = body as {
    reason: string;
    comment?: string;
  };

  if (!reason) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { id: true, tier: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const feedback = await prisma.cancelFeedback.create({
    data: {
      userId: dbUser.id,
      reason,
      comment: comment || null,
      prevTier: dbUser.tier,
    },
  });

  console.log("[api/feedback/cancel] new cancel feedback:", {
    userId: dbUser.id,
    reason,
    prevTier: dbUser.tier,
  });

  return NextResponse.json({ success: true, feedback });
}
