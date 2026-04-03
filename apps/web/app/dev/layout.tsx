import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DevLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });

  if (!session?.user) {
    redirect("/signin");
  }

  if (!(session.user as any).isAdmin) {
    redirect("/");
  }

  return <>{children}</>;
}
