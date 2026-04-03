const { PrismaClient } = require('./node_modules/.prisma/client');
const fs = require('fs');
const path = require('path');
const p = new PrismaClient();

async function main() {
  const devFile = path.join(__dirname, 'data', 'dev-world.json');
  if (!fs.existsSync(devFile)) {
    console.log('No dev-world.json found, nothing to migrate.');
    await p.$disconnect();
    return;
  }

  const raw = fs.readFileSync(devFile, 'utf-8');
  const worldData = JSON.parse(raw);
  console.log('Dev world data:', worldData.gridWidth, 'x', worldData.gridHeight, '|', worldData.layers?.length, 'layers |', worldData.objects?.length, 'objects');

  // Find the arte user's world
  const user = await p.user.findUnique({ where: { handle: 'arte' }, select: { id: true } });
  if (!user) { console.log('User arte not found'); await p.$disconnect(); return; }

  const world = await p.world.findFirst({ where: { ownerId: user.id }, select: { id: true, slug: true } });
  if (!world) { console.log('No world for arte'); await p.$disconnect(); return; }

  console.log('Updating world', world.id, '(slug:', world.slug, ')');

  await p.world.update({
    where: { id: world.id },
    data: {
      width: worldData.gridWidth || 150,
      height: worldData.gridHeight || 150,
      draftData: raw,
      publishedData: raw,
      isPublished: true,
      publishedAt: new Date(),
    },
  });

  console.log('Migration complete! World now has draftData and publishedData.');
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
