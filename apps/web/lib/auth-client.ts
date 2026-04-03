"use client";

import { createAuthClient } from "better-auth/react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authClient: any = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

export const { signIn, signUp, signOut, useSession } = authClient;

/**
 * Sign up with custom fields (handle, etc.)
 * Better Auth additionalFields types need explicit handling on the client.
 */
export async function signUpWithHandle(opts: {
  email: string;
  password: string;
  name: string;
  handle?: string;
  callbackURL?: string;
}) {
  return signUp.email(opts as Parameters<typeof signUp.email>[0]);
}
