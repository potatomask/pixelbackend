import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const error = await requireAdmin(request);
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  const validStatuses = ["new", "reviewed", "resolved"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const feedback = await prisma.feedback.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ feedback });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const error = await requireAdmin(request);
  if (error) return error;

  const { id } = await params;

  await prisma.feedback.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}
