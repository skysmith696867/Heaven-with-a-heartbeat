import { env } from "cloudflare:workers";
import type { GameState } from "./tarocchi";

export type PlayerRecord = { id: string; room_id: string; token: string; name: string; seat: number };
export type RoomRecord = { id: string; code: string; phase: string; state: string };

function db() {
  if (!env.DB) throw new Error("The private game table is unavailable.");
  return env.DB;
}

export async function roomByCode(code: string) {
  return db().prepare("SELECT id, code, phase, state FROM rooms WHERE lower(code) = lower(?) LIMIT 1").bind(code).first<RoomRecord>();
}

export async function playerByToken(token: string) {
  return db().prepare("SELECT id, room_id, token, name, seat FROM players WHERE token = ? LIMIT 1").bind(token).first<PlayerRecord>();
}

export async function playersForRoom(roomId: string) {
  const result = await db().prepare("SELECT id, room_id, token, name, seat FROM players WHERE room_id = ? ORDER BY seat").bind(roomId).all<PlayerRecord>();
  return result.results;
}

export async function createRoom(room: RoomRecord, player: PlayerRecord) {
  await db().batch([
    db().prepare("INSERT INTO rooms (id, code, phase, state) VALUES (?, ?, ?, ?)").bind(room.id, room.code, room.phase, room.state),
    db().prepare("INSERT INTO players (id, room_id, token, name, seat) VALUES (?, ?, ?, ?, ?)").bind(player.id, player.room_id, player.token, player.name, player.seat),
  ]);
}

export async function joinRoom(roomId: string, player: PlayerRecord, state: GameState) {
  await db().batch([
    db().prepare("INSERT INTO players (id, room_id, token, name, seat) VALUES (?, ?, ?, ?, ?)").bind(player.id, player.room_id, player.token, player.name, player.seat),
    db().prepare("UPDATE rooms SET phase = ?, state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(state.phase, JSON.stringify(state), roomId),
  ]);
}

export async function saveState(roomId: string, state: GameState) {
  await db().prepare("UPDATE rooms SET phase = ?, state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(state.phase, JSON.stringify(state), roomId).run();
}

export async function addMessage(roomId: string, playerId: string, body: string) {
  await db().prepare("INSERT INTO messages (room_id, player_id, body) VALUES (?, ?, ?)").bind(roomId, playerId, body).run();
}

export async function messagesForRoom(roomId: string) {
  const result = await db().prepare("SELECT messages.id, messages.body, messages.created_at, players.id AS player_id, players.name FROM messages JOIN players ON players.id = messages.player_id WHERE messages.room_id = ? ORDER BY messages.id").bind(roomId).all();
  return result.results;
}
