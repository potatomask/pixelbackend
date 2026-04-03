import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient();

async function main() {
  // Upsert admin user "arte"
  const admin = await prisma.user.upsert({
    where: { email: "nyflixboy@gmail.com" },
    update: { isAdmin: true, name: "Arte", displayName: "Arte" },
    create: {
      email: "nyflixboy@gmail.com",
      handle: "arte",
      name: "Arte",
      displayName: "Arte",
      isAdmin: true,
      tier: "PRO",
    },
  });

  console.log("Seeded admin user:", admin);

  // Create a credential account if none exists (so admin can sign in with password)
  const existingAccount = await prisma.account.findFirst({
    where: { userId: admin.id, providerId: "credential" },
  });

  if (!existingAccount) {
    await prisma.account.create({
      data: {
        userId: admin.id,
        accountId: admin.id,
        providerId: "credential",
        password: await hashPassword("admin123"),
      },
    });
    console.log("Seeded admin credential account (password: admin123)");
  }

  // Create a default world for the admin if none exists
  const worldCount = await prisma.world.count({
    where: { ownerId: admin.id },
  });

  if (worldCount === 0) {
    const world = await prisma.world.create({
      data: {
        ownerId: admin.id,
        slug: "arte",
        width: 32,
        height: 32,
        tileSize: 16,
        draftData: "{}",
      },
    });
    console.log("Seeded default world:", world);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
