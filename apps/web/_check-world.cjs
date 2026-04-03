const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();

async function main() {
  // Get all worlds
  const worlds = await p.world.findMany({
    select: {
      id: true,
      slug: true,
      ownerId: true,
      isPublished: true,
      publishedAt: true,
      updatedAt: true,
      draftData: true,
      publishedData: true,
    },
  });

  for (const w of worlds) {
    console.log('--- World ---');
    console.log('  id:', w.id);
    console.log('  slug:', w.slug);
    console.log('  ownerId:', w.ownerId);
    console.log('  isPublished:', w.isPublished);
    console.log('  publishedAt:', w.publishedAt);
    console.log('  updatedAt:', w.updatedAt);
    console.log('  draftData length:', w.draftData ? w.draftData.length : 'NULL');
    console.log('  publishedData length:', w.publishedData ? w.publishedData.length : 'NULL');
    if (w.draftData) {
      try {
        const d = JSON.parse(w.draftData);
        console.log('  draftData keys:', Object.keys(d));
        console.log('  draftData.gridWidth:', d.gridWidth);
        console.log('  draftData.layers count:', d.layers?.length);
      } catch(e) { console.log('  draftData parse error:', e.message); }
    }
    if (w.publishedData) {
      try {
        const d = JSON.parse(w.publishedData);
        console.log('  publishedData keys:', Object.keys(d));
      } catch(e) { console.log('  publishedData parse error:', e.message); }
    }
  }

  // Also check users
  const users = await p.user.findMany({ select: { id: true, handle: true, name: true, email: true } });
  console.log('\n--- Users ---');
  for (const u of users) {
    console.log('  ', u.id, '|', u.handle, '|', u.name, '|', u.email);
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
