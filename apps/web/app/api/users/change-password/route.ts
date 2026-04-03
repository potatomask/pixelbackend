import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user has a credential (email/password) account
  const credentialAccount = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "credential" },
  });

  if (!credentialAccount) {
    return NextResponse.json(
      { error: "No password-based account found. You signed in with a social provider." },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = await request.json();

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  if (!currentPassword || typeof currentPassword !== "string") {
    return NextResponse.json(
      { error: "Current password is required" },
      { status: 400 }
    );
  }

  try {
    await auth.api.changePassword({
      headers: request.headers,
      body: { currentPassword, newPassword, revokeOtherSessions: false },
    });
  } catch {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
