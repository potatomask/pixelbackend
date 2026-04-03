import { z } from "zod";

// ─── Payload Schemas ─────────────────────────────────

export const ModalPayloadSchema = z.object({
  kind: z.literal("modal"),
  title: z.string().min(1).max(100),
  body: z.string().max(5000),
});

const HTTPS_URL_RE = /^https:\/\/.+/;

export const LinkPayloadSchema = z.object({
  kind: z.literal("link"),
  url: z
    .string()
    .max(2048)
    .refine((u) => HTTPS_URL_RE.test(u), { message: "URL must start with https://" })
    .refine(
      (u) => {
        try {
          const parsed = new URL(u);
          return parsed.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "Invalid URL" }
    ),
  openInNew: z.boolean(),
});

export const MediaPayloadSchema = z.object({
  kind: z.literal("media"),
  src: z.string().url().max(2048),
  alt: z.string().max(200),
  mediaType: z.enum(["image", "video"]),
});

const PageContentSchema = z.object({
  tiptapDoc: z.record(z.unknown()),
  backgroundColor: z.string().max(20).optional(),
  pageWidth: z.enum(["small", "medium", "full"]).optional(),
});

const ObjectClickActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("openPageEditor"), pageContent: PageContentSchema }),
]);

const ObjectHoverActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("showImage"), imageUrl: z.string().max(2048) }),
  z.object({ type: z.literal("showVideo"), videoUrl: z.string().max(2048) }),
  z.object({ type: z.literal("showText"), text: z.string().max(500) }),
]);

const ObjectBillboardActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("showImage"), imageUrl: z.string().max(2048) }),
  z.object({ type: z.literal("showVideo"), videoUrl: z.string().max(2048) }),
  z.object({ type: z.literal("showText"), text: z.string().max(500) }),
]);

export const CustomObjectPayloadSchema = z.object({
  kind: z.literal("custom"),
  objectDefId: z.string().min(1).max(128),
  variationIndex: z.number().int().min(0).optional(),
  interactable: z.boolean().optional(),
  onClick: ObjectClickActionSchema.optional(),
  onHover: ObjectHoverActionSchema.optional(),
  billboard: ObjectBillboardActionSchema.optional(),
  billboardClosable: z.boolean().optional(),
  billboardOpen: z.boolean().optional(),
  billboardPreview: z.boolean().optional(),
  billboardMediaScale: z.number().min(0.25).max(4).optional(),
  billboardAnchor: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
  hoverPreview: z.boolean().optional(),
  hoverMediaScale: z.number().min(0.25).max(4).optional(),
  hoverAnchor: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});

export const PayloadSchema = z.discriminatedUnion("kind", [
  ModalPayloadSchema,
  LinkPayloadSchema,
  MediaPayloadSchema,
  CustomObjectPayloadSchema,
]);

// ─── World Object Schema ────────────────────────────

export const WorldObjectSchema = z.object({
  id: z.string().min(1).max(32),
  type: z.enum(["modal", "link", "media", "custom"]),
  gridX: z.number().int().min(0),
  gridY: z.number().int().min(0),
  label: z.string().max(100),
  payload: PayloadSchema,
  cooldownMs: z.number().int().min(0).max(10000).default(500),
});

// ─── Side Page Link Schema ──────────────────────────

export const SidePageLinkSchema = z.object({
  id: z.string().min(1).max(32),
  title: z.string().min(1).max(100),
  url: z.string().url().max(2048),
  order: z.number().int().min(0),
  imageUrl: z.string().max(2048).optional(),
});

// ─── Side Page Theme Schema ─────────────────────────

const ThemeSpriteRefSchema = z.object({
  src: z.string(),
  x: z.number(),
  y: z.number(),
  widthTiles: z.number().int().min(1).max(8).optional(),
  heightTiles: z.number().int().min(1).max(8).optional(),
  scale: z.number().min(0.25).max(4).optional(),
});

const NineSliceTilesSchema = z.object({
  topLeft: ThemeSpriteRefSchema.optional(),
  top: ThemeSpriteRefSchema.optional(),
  topRight: ThemeSpriteRefSchema.optional(),
  left: ThemeSpriteRefSchema.optional(),
  center: ThemeSpriteRefSchema.optional(),
  right: ThemeSpriteRefSchema.optional(),
  bottomLeft: ThemeSpriteRefSchema.optional(),
  bottom: ThemeSpriteRefSchema.optional(),
  bottomRight: ThemeSpriteRefSchema.optional(),
});

export const SidePageThemeSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  icon: z.union([ThemeSpriteRefSchema, z.string().max(2048)]).optional(),
  isDefault: z.boolean().default(false),
  freeTierOk: z.boolean().optional(),
  contentInsetPx: z.number().int().min(0).max(128).optional(),
  visualOverflowPx: z.number().int().min(0).max(160).optional(),
  designScale: z.number().min(0.5).max(3).optional(),
  designOffsetXPx: z.number().int().min(-256).max(256).optional(),
  designOffsetYPx: z.number().int().min(-256).max(256).optional(),
  tiles: NineSliceTilesSchema,
  buttons: z.object({
    link: z.object({
      bg: NineSliceTilesSchema.optional(),
      icon: ThemeSpriteRefSchema.optional(),
      inheritMainFrameBg: z.boolean().optional(),
    }),
    settings: z.object({
      bg: NineSliceTilesSchema.optional(),
      icon: ThemeSpriteRefSchema.optional(),
      inheritMainFrameBg: z.boolean().optional(),
    }),
    theme: z.object({
      bg: NineSliceTilesSchema.optional(),
      icon: ThemeSpriteRefSchema.optional(),
      inheritMainFrameBg: z.boolean().optional(),
    }).optional(),
  })
});

// ─── Side Page Config Schema ────────────────────────

export const SidePageConfigSchema = z.object({
  enabled: z.boolean().default(true),
  headerText: z.string().max(200).optional(),
  headerBold: z.boolean().default(false).optional(),
  headerItalic: z.boolean().default(false).optional(),
  headerAlign: z.enum(["left", "center", "right"]).default("left").optional(),
  links: z.array(SidePageLinkSchema).max(50).default([]),
  backgroundColor: z.string().max(20).optional(),
  textColor: z.string().max(20).optional(),
  linkColor: z.string().max(20).optional(),
  font: z.enum(["system", "serif", "monospace", "pixel", "rounded", "tiny5", "bytesized"]).optional(),
  showByDefault: z.boolean().default(false).optional(),
  themes: z.array(SidePageThemeSchema).max(20).optional(),
});

// ─── World Data Schema ──────────────────────────────

const TileRowSchema = z.array(z.number().int().min(0));
const TileGridSchema = z.array(TileRowSchema);
const TileLayersSchema = z.array(TileGridSchema).min(1);

// ─── World Assets Schema ────────────────────────────

// Keep assets schema intentionally permissive so new editor/runtime fields
// never block world saves. Core world shape is still validated by WorldDataSchema.
const LooseObjectSchema = z.record(z.string(), z.unknown());

export const WorldAssetsSchema: z.ZodType<import("./types").WorldAssets> = z
  .object({
    tiles: z.array(LooseObjectSchema).optional(),
    objects: z.array(LooseObjectSchema).optional(),
    animations: z.array(LooseObjectSchema).optional(),
    characterConfig: LooseObjectSchema.nullable().optional(),
    tags: z.array(LooseObjectSchema).optional(),
    autotileCenterVariants: z
      .record(z.string(), z.array(LooseObjectSchema))
      .optional(),
    autotileLinearMaps: z
      .record(z.string(), z.array(LooseObjectSchema))
      .optional(),
  })
  .passthrough() as z.ZodType<import("./types").WorldAssets>;

export const WorldDataSchema = z.object({
  version: z.number().int().min(1),
  gridWidth: z.number().int().min(1),
  gridHeight: z.number().int().min(1),
  spawnX: z.number().int().min(0),
  spawnY: z.number().int().min(0),
  layers: TileLayersSchema,
  objects: z.array(WorldObjectSchema),
  assets: WorldAssetsSchema.optional(),
  sidePageConfig: SidePageConfigSchema.optional(),
});

// ─── API Input Schemas ──────────────────────────────

export const CreateWorldSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, {
      message: "Slug must be lowercase alphanumeric with hyphens, 3-48 chars",
    }),
  width: z.number().int().min(1).max(500).default(20),
  height: z.number().int().min(1).max(500).default(15),
});

export const UpdateProfileSchema = z.object({
  displayName: z.string().max(64).optional(),
  image: z.string().max(2048).optional(),
  bio: z.string().max(280).optional(),
  themeColors: z
    .object({
      primary: z.string().max(7),
      bg: z.string().max(7),
      accent: z.string().max(7),
    })
    .optional(),
});

export const AnalyticsEventSchema = z.object({
  worldId: z.string().min(1),
  eventType: z.enum(["page_view", "interaction"]),
  objectId: z.string().max(32).optional(),
  deviceType: z.enum(["mobile", "desktop", "tablet"]),
});

export const ReportSchema = z.object({
  worldId: z.string().min(1),
  reason: z.string().min(10).max(500),
});
