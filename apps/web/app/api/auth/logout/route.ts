import { NextResponse } from "next/server";

// Legacy logout route — Better Auth handles logout at /api/auth/sign-out
export async function POST() {
  return NextResponse.json(
    { error: "This logout endpoint is deprecated. Use Better Auth sign-out." },
    { status: 410 },
  );
}
