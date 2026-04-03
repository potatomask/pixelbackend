import { type NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";

/**
 * Get the authenticated user from a request using Better Auth session.
 * Returns the user or a 401 error response.
 */
export async function getAuthUser(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user: session.user, error: null };
}

/**
 * Verify the request is from an admin user.
 * Returns null if ok, or an error response.
 */
export async function requireAdmin(request: NextRequest | Headers) {
  const hdrs = request instanceof Headers ? request : request.headers;
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(session.user as any).isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
