import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const acct = await p.account.findFirst({
    where: { providerId: "credential" },
    select: { accountId: true, userId: true, providerId: true, password: true },
  });
  console.log("Account:", JSON.stringify(acct, null, 2));

  const user = await p.user.findFirst({
    select: { id: true, email: true, handle: true, isAdmin: true },
  });
  console.log("User:", JSON.stringify(user, null, 2));

  await p.$disconnect();
}

main().catch(console.error);
