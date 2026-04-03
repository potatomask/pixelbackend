import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "better-auth/crypto";

const p = new PrismaClient();

async function main() {
  const acct = await p.account.findFirst({
    where: { providerId: "credential" },
    select: { password: true },
  });

  if (!acct?.password) {
    console.log("No account found!");
    return;
  }

  const valid = await verifyPassword({ hash: acct.password, password: "admin123" });
  console.log("Password 'admin123' valid:", valid);

  await p.$disconnect();
}

main().catch(console.error);
