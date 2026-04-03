import {
  pgTable,
  uuid,
  text,
  varchar,
  jsonb,
  timestamp,
  boolean,
  integer,
  bigserial,
  index,
  smallint,
  real,
} from "drizzle-orm/pg-core";
import type { WorldData, ThemeColors } from "@mypixelpage/shared";

// ─── Users ───────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  handle: varchar("handle", { length: 32 }).notNull().unique(),
  displayName: varchar("display_name", { length: 64 }),
  avatarUrl: text("avatar_url"),
  themeColors: jsonb("theme_colors").$type<ThemeColors>(),
  bio: varchar("bio", { length: 280 }),
  tier: varchar("tier", { length: 16 }).notNull().default("FREE"),
  tierExpiresAt: timestamp("tier_expires_at"),
  paidSince: timestamp("paid_since"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Cancel Feedback ─────────────────────────────────

export const cancelFeedback = pgTable("cancel_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 100 }).notNull(),
  comment: text("comment"),
  prevTier: varchar("prev_tier", { length: 16 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── General Feedback ────────────────────────────────

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull().default("general"),
  message: text("message").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Admin Stats Snapshots ────────────────────────────

export const statsSnapshots = pgTable("stats_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  date: timestamp("date").notNull().unique(),
  totalUsers: integer("total_users").notNull().default(0),
  freeUsers: integer("free_users").notNull().default(0),
  starterUsers: integer("starter_users").notNull().default(0),
  proUsers: integer("pro_users").notNull().default(0),
  totalWorlds: integer("total_worlds").notNull().default(0),
  publishedWorlds: integer("published_worlds").notNull().default(0),
  newSignups: integer("new_signups").notNull().default(0),
  revenue: real("revenue").notNull().default(0),
});

// ─── Worlds ──────────────────────────────────────────

export const worlds = pgTable("worlds", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 48 }).notNull().unique(),
  width: integer("width").notNull().default(32),
  height: integer("height").notNull().default(32),
  tileSize: integer("tile_size").notNull().default(16),
  draftData: jsonb("draft_data").$type<WorldData>().notNull(),
  publishedData: jsonb("published_data").$type<WorldData>(),
  publishedAt: timestamp("published_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isPublished: boolean("is_published").notNull().default(false),
});

// ─── Publish Records ────────────────────────────────

export const publishRecords = pgTable("publish_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldId: uuid("world_id")
    .notNull()
    .references(() => worlds.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  data: jsonb("data").$type<WorldData>().notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
});

// ─── Analytics Events ────────────────────────────────

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    objectId: varchar("object_id", { length: 32 }),
    deviceType: varchar("device_type", { length: 16 }),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    worldIdx: index("analytics_world_idx").on(table.worldId),
    timeIdx: index("analytics_time_idx").on(table.timestamp),
  })
);

// ─── Reports ─────────────────────────────────────────

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  worldId: uuid("world_id")
    .notNull()
    .references(() => worlds.id),
  reason: varchar("reason", { length: 500 }).notNull(),
  reporterIp: varchar("reporter_ip", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolved: boolean("resolved").notNull().default(false),
});

// ─── Tile Definitions (admin-managed) ────────────────

export const tileDefinitions = pgTable("tile_definitions", {
  id: integer("id").primaryKey(),                // matches TileDef.id (0 reserved for empty)
  name: varchar("name", { length: 64 }).notNull(),
  color: varchar("color", { length: 9 }).notNull(),  // fallback hex e.g. "#4a7c59"
  walkable: boolean("walkable").notNull().default(true),
  tilesetSrc: text("tileset_src"),               // URL path to tileset image
  srcX: integer("src_x").notNull().default(0),
  srcY: integer("src_y").notNull().default(0),
  tileCost: real("tile_cost").notNull().default(1),
  autoTile: boolean("auto_tile").notNull().default(false),
  zLayer: smallint("z_layer").notNull().default(1),  // 0=water, 1=ground, 2=overlay
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
