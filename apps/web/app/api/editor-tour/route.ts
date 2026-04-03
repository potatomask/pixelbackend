import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-utils";
import { getEditorTourCompletedAt, markEditorTourCompleted } from "@/lib/editor-tour";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const completedAt = await getEditorTourCompletedAt(user!.id);
  return NextResponse.json({
    completed: Boolean(completedAt),
    completedAt,
  });
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await getAuthUser(request);
  if (error) return error;

  const completedAt = await markEditorTourCompleted(user!.id);
  return NextResponse.json({ ok: true, completedAt });
}
