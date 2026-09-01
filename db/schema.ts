import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  phase: text("phase").notNull().default("waiting"),
  state: text("state").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const players = sqliteTable("players", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  token: text("token").unique(),
  historyToken: text("history_token").notNull().unique(),
  name: text("name").notNull(),
  avatarData: text("avatar_data"),
  seat: integer("seat").notNull(),
  joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const archivedMatches = sqliteTable("archived_matches", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  playerId: text("player_id").notNull(),
  historyToken: text("history_token").notNull(),
  opponentName: text("opponent_name").notNull(),
  archivedAt: text("archived_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  result: text("result").notNull(),
  forfeit: integer("forfeit", { mode: "boolean" }).notNull().default(false),
  scoreboard: text("scoreboard").notNull(),
  prompts: text("prompts").notNull(),
  messages: text("messages").notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const chronicleAnswers = sqliteTable("chronicle_answers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomId: text("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull(),
  answer: text("answer").notNull(),
  pointsAwarded: integer("points_awarded", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("chronicle_answers_player_question_unique").on(table.playerId, table.questionId)]);
