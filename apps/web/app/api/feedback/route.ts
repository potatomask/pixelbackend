import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const FEEDBACK_IMAGE_TAG = /\[\[feedback-image:(.+?)\]\]/;
const ALLOWED_FEEDBACK_IMAGE_URL = /^\/uploads\/.+\.(png|jpe?g)$/i;

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!rateLimit(`feedback:${session.user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please wait before sending more feedback." }, { status: 429 });
  }

  const body = await request.json();
  const { type, message, imageUrl } = body;

  const cleanMessage = typeof message === "string" ? message.trim() : "";
  const cleanImageUrl = typeof imageUrl === "string" ? imageUrl.trim() : "";

  if (!cleanMessage && !cleanImageUrl) {
    return NextResponse.json({ error: "Message or image is required" }, { status: 400 });
  }

  if (cleanImageUrl && (!ALLOWED_FEEDBACK_IMAGE_URL.test(cleanImageUrl) || FEEDBACK_IMAGE_TAG.test(cleanImageUrl))) {
    return NextResponse.json({ error: "Only PNG and JPG feedback images are supported" }, { status: 400 });
  }

  const validTypes = ["general", "bug", "feature"];
  const feedbackType = validTypes.includes(type) ? type : "general";
  const storedMessage = `${cleanMessage.slice(0, 2000)}${cleanImageUrl ? `${cleanMessage ? "\n\n" : ""}[[feedback-image:${cleanImageUrl}]]` : ""}`;

  const feedback = await prisma.feedback.create({
    data: {
      userId: session.user.id,
      type: feedbackType,
      message: storedMessage,
    },
  });

  return NextResponse.json({ id: feedback.id }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins can list all feedback
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const feedbacks = await prisma.feedback.findMany({
    include: { user: { select: { handle: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ feedbacks });
}
