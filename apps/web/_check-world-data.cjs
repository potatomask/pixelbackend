const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const worlds = await p.world.findMany({
    select: { id: true, ownerId: true, slug: true, draftData: true, publishedData: true, updatedAt: true }
  });
  
  for (const w of worlds) {
    const draftLen = w.draftData ? w.draftData.length : 0;
    const pubLen = w.publishedData ? w.publishedData.length : 0;
    
    // Parse draft to check contents
    let objectCount = 0;
    let hasAssets = false;
    let hasSidePageThemes = false;
    let layerTileCount = 0;
    try {
      const draft = JSON.parse(w.draftData);
      objectCount = draft.objects ? draft.objects.length : 0;
      hasAssets = !!(draft.assets && (draft.assets.tiles || draft.assets.objects));
      hasSidePageThemes = !!(draft.sidePageConfig && draft.sidePageConfig.themes && draft.sidePageConfig.themes.length > 0);
      if (draft.layers) {
        for (const layer of draft.layers) {
          for (const row of layer) {
            for (const cell of row) {
              if (cell !== 0) layerTileCount++;
            }
          }
        }
      }
    } catch {}
    
    console.log(`\n=== World: ${w.slug} (${w.id}) ===`);
    console.log(`  Owner: ${w.ownerId}`);
    console.log(`  Updated: ${w.updatedAt}`);
    console.log(`  Draft size: ${draftLen} bytes`);
    console.log(`  Published size: ${pubLen} bytes`);
    console.log(`  Objects: ${objectCount}`);
    console.log(`  Placed tiles: ${layerTileCount}`);
    console.log(`  Has assets blob: ${hasAssets}`);
    console.log(`  Has sidepage themes: ${hasSidePageThemes}`);
  }
  
  await p.$disconnect();
}

main().catch(console.error);
