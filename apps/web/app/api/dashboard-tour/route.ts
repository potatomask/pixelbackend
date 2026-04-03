import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-utils";
import { getDashboardTourCompletedAt, markDashboardTourCompleted } from "@/lib/dashboard-tour";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const completedAt = await getDashboardTourCompletedAt(user!.id);
  return NextResponse.json({
    completed: Boolean(completedAt),
    completedAt,
  });
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const completedAt = await markDashboardTourCompleted(user!.id);
  return NextResponse.json({ ok: true, completedAt });
}