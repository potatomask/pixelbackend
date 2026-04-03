import { NextResponse } from "next/server";

// Legacy login route — redirects to Better Auth sign-in
// All authentication now goes through Better Auth at /api/auth/*
export async function POST() {
  return NextResponse.json(
    { error: "This login endpoint is deprecated. Use /signin with Better Auth." },
    { status: 410 },
  );
}

export async function GET() {
  // Only redirect to our own app origin — never allow arbitrary domains
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  let origin: string;
  try {
    origin = new URL(appUrl).origin;
  } catch {
    origin = "http://localhost:3000";
  }
  return NextResponse.redirect(new URL("/signin", origin));
}
