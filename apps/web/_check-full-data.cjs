const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check the main world (arte)
  const world = await p.world.findFirst({
    where: { slug: 'arte' },
    select: { id: true, draftData: true }
  });
  
  if (!world) { console.log('No world found'); return; }
  
  const draft = JSON.parse(world.draftData);
  
  console.log('=== WORLD DATA ANALYSIS ===');
  console.log(`Objects in world: ${draft.objects?.length ?? 0}`);
  console.log(`Grid: ${draft.gridWidth}x${draft.gridHeight}`);
  console.log(`Layers: ${draft.layers?.length ?? 0}`);
  
  // Check assets blob
  const assets = draft.assets;
  if (assets) {
    console.log('\n=== ASSETS BLOB ===');
    console.log(`Tile defs: ${assets.tiles?.length ?? 0}`);
    console.log(`Object defs: ${assets.objects?.length ?? 0}`);
    console.log(`Animation defs: ${assets.animations?.length ?? 0}`);
    console.log(`Character config: ${assets.characterConfig ? 'YES' : 'NO'}`);
    console.log(`Tags: ${assets.tags?.length ?? 0}`);
    console.log(`Autotile center variants: ${assets.autotileCenterVariants ? Object.keys(assets.autotileCenterVariants).length + ' tilesets' : 'NO'}`);
    console.log(`Autotile linear maps: ${assets.autotileLinearMaps ? Object.keys(assets.autotileLinearMaps).length + ' tilesets' : 'NO'}`);
    
    if (assets.objects) {
      console.log('\n=== OBJECT DEFS IN ASSETS ===');
      for (const obj of assets.objects) {
        console.log(`  - ${obj.id}: ${obj.name || '(unnamed)'} [${obj.widthTiles}x${obj.heightTiles}]`);
      }
    }
  } else {
    console.log('\nNO ASSETS BLOB!');
  }
  
  // Check sidePageConfig themes
  if (draft.sidePageConfig) {
    console.log('\n=== SIDEPAGE CONFIG ===');
    console.log(`Enabled: ${draft.sidePageConfig.enabled}`);
    console.log(`Links: ${draft.sidePageConfig.links?.length ?? 0}`);
    console.log(`Themes: ${draft.sidePageConfig.themes?.length ?? 0}`);
    if (draft.sidePageConfig.themes) {
      for (const t of draft.sidePageConfig.themes) {
        console.log(`  - ${t.id}: "${t.name}" ${t.isDefault ? '(DEFAULT)' : ''}`);
      }
    }
  }
  
  // Check SiteSettings (categories, credit config)
  const settings = await p.siteSetting.findMany();
  console.log('\n=== SITE SETTINGS ===');
  for (const s of settings) {
    const val = s.value;
    const parsed = JSON.parse(val);
    if (s.key === 'dev-categories') {
      console.log(`Categories: ${Array.isArray(parsed) ? parsed.length : 'N/A'} items`);
      if (Array.isArray(parsed)) {
        for (const cat of parsed) {
          console.log(`  - ${cat.id}: "${cat.name}" (${cat.items?.length ?? 0} items, limit=${JSON.stringify(cat.limits || {})})`);
        }
      }
    } else if (s.key === 'dev-credit-config') {
      console.log(`Credit config: ${JSON.stringify(parsed).substring(0, 200)}`);
    } else {
      console.log(`${s.key}: ${val.substring(0, 100)}...`);
    }
  }
  
  // Also check: how many UNIQUE object defs are referenced by world objects
  // vs how many are in the assets blob
  const referencedDefIds = new Set();
  for (const obj of (draft.objects || [])) {
    if (obj.payload?.kind === 'custom' && obj.payload.objectDefId) {
      referencedDefIds.add(obj.payload.objectDefId);
    }
  }
  console.log(`\n=== OBJECT DEF USAGE ===`);
  console.log(`Unique object defs referenced by placed objects: ${referencedDefIds.size}`);
  console.log(`Object defs in assets blob: ${assets?.objects?.length ?? 0}`);
  
  // Check if any referenced defs are MISSING from assets
  if (assets?.objects) {
    const assetDefIds = new Set(assets.objects.map(o => o.id));
    const missing = [...referencedDefIds].filter(id => !assetDefIds.has(id));
    if (missing.length > 0) {
      console.log(`MISSING defs (referenced but not in assets): ${missing.join(', ')}`);
    } else {
      console.log(`All referenced defs present in assets blob ✓`);
    }
  }
  
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
