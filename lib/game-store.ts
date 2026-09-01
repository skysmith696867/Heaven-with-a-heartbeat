import { env } from "cloudflare:workers";
import type { GameState } from "./tarocchi";

export type PlayerRecord = { id: string; room_id: string; token: string | null; history_token: string; name: string; avatar_data?: string | null; seat: number };
export type RoomRecord = { id: string; code: string; phase: string; state: string };
export type ArchiveRecord = { id: string; room_id: string; player_id: string; opponent_name: string; archived_at: string; result: string; forfeit: number; scoreboard: string; prompts: string; messages: string };
export type ChronicleAnswerRecord = { player_id: string; question_id: number; answer: string; points_awarded: number; updated_at: string };
export type ChroniclePublicProfile = { playerId: string; name: string; avatarData: string | null; answers: Record<string, string>; awardedQuestionIds: number[]; bonusPoints: number };

function db() {
  if (!env.DB) throw new Error("The private game table is unavailable.");
  return env.DB;
}

export async function roomByCode(code: string, activeOnly = false) {
  const activeClause = activeOnly ? " AND phase IN ('waiting', 'playing')" : "";
  return db().prepare(`SELECT id, code, phase, state FROM rooms WHERE lower(code) = lower(?)${activeClause} LIMIT 1`).bind(code).first<RoomRecord>();
}

export async function archiveClosedRoomCode(roomId: string, code: string) {
  await db().prepare("UPDATE rooms SET code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND phase NOT IN ('waiting', 'playing')")
    .bind(`${code} · past ${roomId.slice(0, 6)}`, roomId).run();
}

export async function playerByToken(token: string) {
  return db().prepare("SELECT id, room_id, token, history_token, name, avatar_data, seat FROM players WHERE token = ? LIMIT 1").bind(token).first<PlayerRecord>();
}

export async function playerByHistoryToken(token: string) {
  return db().prepare("SELECT id, room_id, token, history_token, name, avatar_data, seat FROM players WHERE history_token = ? LIMIT 1").bind(token).first<PlayerRecord>();
}

export async function playersForRoom(roomId: string) {
  const result = await db().prepare("SELECT id, room_id, token, history_token, name, avatar_data, seat FROM players WHERE room_id = ? ORDER BY seat").bind(roomId).all<PlayerRecord>();
  return result.results;
}

export async function createRoom(room: RoomRecord, player: PlayerRecord) {
  await db().batch([
    db().prepare("INSERT INTO rooms (id, code, phase, state) VALUES (?, ?, ?, ?)").bind(room.id, room.code, room.phase, room.state),
    db().prepare("INSERT INTO players (id, room_id, token, history_token, name, seat) VALUES (?, ?, ?, ?, ?, ?)").bind(player.id, player.room_id, player.token, player.history_token, player.name, player.seat),
  ]);
}

export async function joinRoom(roomId: string, player: PlayerRecord, state: GameState) {
  await db().batch([
    db().prepare("INSERT INTO players (id, room_id, token, history_token, name, seat) VALUES (?, ?, ?, ?, ?, ?)").bind(player.id, player.room_id, player.token, player.history_token, player.name, player.seat),
    db().prepare("UPDATE rooms SET phase = ?, state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(state.phase, JSON.stringify(state), roomId),
  ]);
}

export async function revokeActiveToken(playerId: string) {
  await db().prepare("UPDATE players SET token = NULL WHERE id = ?").bind(playerId).run();
}

export async function archiveMatch(roomId: string, entries: { id: string; playerId: string; historyToken: string; opponentName: string; result: string; forfeit: boolean; scoreboard: string; prompts: string; messages: string }[]) {
  await db().batch(entries.map((entry) => db().prepare("INSERT OR IGNORE INTO archived_matches (id, room_id, player_id, history_token, opponent_name, result, forfeit, scoreboard, prompts, messages) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(entry.id, roomId, entry.playerId, entry.historyToken, entry.opponentName, entry.result, entry.forfeit ? 1 : 0, entry.scoreboard, entry.prompts, entry.messages)));
}

export async function archivedMatchesForToken(token: string) {
  const result = await db().prepare("SELECT id, room_id, player_id, opponent_name, archived_at, result, forfeit, scoreboard, prompts, messages FROM archived_matches WHERE history_token = ? ORDER BY archived_at DESC").bind(token).all<ArchiveRecord>();
  return result.results.map((archive) => ({ ...archive, forfeit: Boolean(archive.forfeit), scoreboard: JSON.parse(archive.scoreboard), prompts: JSON.parse(archive.prompts), messages: JSON.parse(archive.messages) }));
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

export async function chroniclesForRoom(roomId: string) {
  const [players, answerResult] = await Promise.all([
    playersForRoom(roomId),
    db().prepare("SELECT player_id, question_id, answer, points_awarded, updated_at FROM chronicle_answers WHERE room_id = ? ORDER BY question_id").bind(roomId).all<ChronicleAnswerRecord>(),
  ]);
  return players.map((player) => {
    const playerAnswers = answerResult.results.filter((answer) => answer.player_id === player.id);
    const awardedQuestionIds = playerAnswers.filter((answer) => Boolean(answer.points_awarded)).map((answer) => answer.question_id);
    return { playerId: player.id, name: player.name, avatarData: player.avatar_data, answers: Object.fromEntries(playerAnswers.map((answer) => [String(answer.question_id), answer.answer])), awardedQuestionIds, bonusPoints: awardedQuestionIds.length * 5 } satisfies ChroniclePublicProfile;
  });
}

export async function saveChronicleAnswer(roomId: string, playerId: string, questionId: number, answer: string) {
  const existing = await db().prepare("SELECT points_awarded FROM chronicle_answers WHERE player_id = ? AND question_id = ? LIMIT 1").bind(playerId, questionId).first<{ points_awarded: number }>();
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const pointsAwarded = Boolean(existing?.points_awarded) || wordCount >= 50;
  await db().prepare(`INSERT INTO chronicle_answers (room_id, player_id, question_id, answer, points_awarded)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(player_id, question_id) DO UPDATE SET answer = excluded.answer, points_awarded = excluded.points_awarded, updated_at = CURRENT_TIMESTAMP`)
    .bind(roomId, playerId, questionId, answer, pointsAwarded ? 1 : 0).run();
  return { awardedNow: !existing?.points_awarded && pointsAwarded, wordCount };
}

export async function savePlayerAvatar(playerId: string, avatarData: string) {
  await db().prepare("UPDATE players SET avatar_data = ? WHERE id = ?").bind(avatarData, playerId).run();
}
