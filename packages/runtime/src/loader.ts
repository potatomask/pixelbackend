import { Assets, Spritesheet, Texture } from "pixi.js";

/**
 * Load a spritesheet by tileset reference key.
 * For V1, we generate a simple procedural tileset if the default is requested.
 * Later this will load real atlas files.
 */
export async function loadSpritesheet(tilesetRef: string): Promise<Spritesheet> {
  // Try to load from assets path
  const assetPath = `/assets/tilesets/${tilesetRef}.json`;

  try {
    const sheet = await Assets.load<Spritesheet>(assetPath);
    if (sheet && sheet.textures) return sheet;
  } catch {
    // Fall through to procedural generation
  }

  // Generate a procedural tileset for development
  return generateProceduralTileset();
}

/**
 * Generates a simple 16-tile procedural spritesheet for development.
 * Tiles: 1=grass, 2=dirt, 3=stone, 4=wood, 5=water,
 *        6=wall-brick, 7=wall-dark, 8=sand,
 *        9-12=decor colors, 13-16=object markers
 */
async function generateProceduralTileset(): Promise<Spritesheet> {
  const tileSize = 16;
  const cols = 4;
  const rows = 4;
  const canvas = document.createElement("canvas");
  canvas.width = cols * tileSize;
  canvas.height = rows * tileSize;
  const ctx = canvas.getContext("2d")!;

  const colors = [
    "#4a7c59", // 1: grass
    "#8B7355", // 2: dirt
    "#808080", // 3: stone floor
    "#A0522D", // 4: wood
    "#4169E1", // 5: water
    "#8B4513", // 6: wall brick
    "#2F2F2F", // 7: wall dark
    "#F4E0B9", // 8: sand
    "#228B22", // 9: bush/tree
    "#FF6347", // 10: flower
    "#DDA0DD", // 11: purple decor
    "#87CEEB", // 12: light blue decor
    "#FFD700", // 13: gold marker (modal)
    "#00FF7F", // 14: green marker (link)
    "#FF8C00", // 15: orange marker (media)
    "#FFFFFF", // 16: white marker
  ];

  for (let i = 0; i < colors.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = col * tileSize;
    const y = row * tileSize;

    ctx.fillStyle = colors[i]!;
    ctx.fillRect(x, y, tileSize, tileSize);

    // Add slight texture variation
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(x, y, tileSize, 1);
    ctx.fillRect(x, y, 1, tileSize);

    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(x + tileSize - 1, y, 1, tileSize);
    ctx.fillRect(x, y + tileSize - 1, tileSize, 1);
  }

  // Create PixiJS texture from canvas
  const baseTexture = Texture.from(canvas);

  // Build spritesheet data
  const frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> = {};
  for (let i = 0; i < colors.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    frames[`tile_${i + 1}`] = {
      frame: {
        x: col * tileSize,
        y: row * tileSize,
        w: tileSize,
        h: tileSize,
      },
    };
  }

  const sheet = new Spritesheet(baseTexture, {
    frames,
    meta: {
      scale: 1,
    },
  });

  await sheet.parse();
  return sheet;
}
