import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    select: { providerId: true, accountId: true, createdAt: true },
  });

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      provider: a.providerId,
      accountId: a.accountId,
      linkedAt: a.createdAt,
    })),
  });
}
