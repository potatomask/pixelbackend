const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();

async function main() {
  const u = await p.user.findUnique({ where: { handle: 'arte' }, select: { id: true, handle: true } });
  console.log('User:', u);
  
  if (!u) { console.log('User not found'); return; }
  
  const w = await p.world.findFirst({ where: { ownerId: u.id } });
  console.log('Existing world:', w);
  
  if (!w) {
    // Create empty world data matching createEmptyWorldData() from shared package
    const gridWidth = 30;
    const gridHeight = 30;
    const emptyData = {
      gridWidth,
      gridHeight,
      tileSize: 16,
      layers: [
        { id: 'ground', name: 'Ground', tiles: {}, visible: true },
        { id: 'paths', name: 'Paths', tiles: {}, visible: true },
        { id: 'overlay', name: 'Overlay', tiles: {}, visible: true },
      ],
      objects: [],
      spawnX: Math.floor(gridWidth / 2),
      spawnY: Math.floor(gridHeight / 2),
      animations: [],
      assets: { tilesets: {}, objects: {}, animations: {} },
    };
    
    const created = await p.world.create({
      data: {
        ownerId: u.id,
        slug: u.handle,
        width: gridWidth,
        height: gridHeight,
        draftData: JSON.stringify(emptyData),
      },
    });
    console.log('Created world:', created.id, created.slug);
  } else {
    console.log('World already exists');
  }
  
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
