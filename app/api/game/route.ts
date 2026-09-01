import { addMessage, archiveMatch, archivedMatchesForToken, chroniclesForRoom, createRoom, joinRoom, messagesForRoom, playerByHistoryToken, playerByToken, playersForRoom, revokeActiveToken, roomByCode, saveChronicleAnswer, savePlayerAvatar, saveState, type ChroniclePublicProfile } from "@/lib/game-store";
import { chronicleQuestionIds } from "@/lib/chronicle";
import { archiveEntries, beginGame, closeMatch, initialState, leaveMatch, playCard, prompts, readyFromIntermission, scoreCards, type GameState } from "@/lib/tarocchi";

function cleanName(value: unknown) {
  return String(value ?? "").trim().slice(0, 24);
}

const phraseBeginnings = ["Velvet", "Holographic", "Secret", "Fallen", "Celestial", "Electric", "Impossible", "Moonlit", "Hidden", "Heavenly", "Blushing", "Wandering", "Silver", "Neon", "Ancient", "Euphoric"];
const phraseMiddles = ["moon", "comet", "archive", "kingdom", "oracle", "heart", "library", "saturn", "dream", "constellation", "garden", "relic", "starlight", "riddle", "heaven", "mirage"];
const phraseEndings = ["whispers", "remembers", "screams", "returns", "glows", "waits", "awakens", "knows", "dreams", "falls", "watches", "dances", "opens", "lingers", "answers", "rises"];

async function roomCode() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const phrase = `${phraseBeginnings[Math.floor(Math.random() * phraseBeginnings.length)]} ${phraseMiddles[Math.floor(Math.random() * phraseMiddles.length)]} ${phraseEndings[Math.floor(Math.random() * phraseEndings.length)]}`;
    if (!(await roomByCode(phrase))) return phrase;
  }
  return `Secret constellation ${crypto.randomUUID().slice(0, 8)}`;
}

function tokenFrom(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
}

function publicState(state: GameState, playerId: string, messages: unknown[], chronicles: ChroniclePublicProfile[] = []) {
  const activeIds = state.playerIds.filter((id) => !(state.departedIds ?? []).includes(id));
  const opponentId = activeIds.find((id) => id !== playerId) ?? null;
  const prompt = state.promptIndex > 0 ? prompts[(state.promptIndex - 1) % prompts.length] : null;
  const bonusFor = (id: string) => chronicles.find((profile) => profile.playerId === id)?.bonusPoints ?? 0;
  const totalScoreFor = (id: string) => scoreCards(state.captured[id]) + bonusFor(id);
  const completedScores = activeIds.map((id) => ({ id, score: totalScoreFor(id) })).sort((a, b) => b.score - a.score);
  const scoredWinnerId = completedScores.length === 2 && completedScores[0].score === completedScores[1].score ? null : completedScores[0]?.id ?? null;
  return {
    phase: state.phase,
    matchExit: state.matchExit ?? null,
    you: { id: playerId, name: state.playerNames[playerId], avatarData: chronicles.find((profile) => profile.playerId === playerId)?.avatarData ?? null, hand: state.hands[playerId] ?? [], score: totalScoreFor(playerId), chronicleBonus: bonusFor(playerId) },
    opponent: opponentId ? { id: opponentId, name: state.playerNames[opponentId], avatarData: chronicles.find((profile) => profile.playerId === opponentId)?.avatarData ?? null, cardCount: state.hands[opponentId]?.length ?? 0, score: totalScoreFor(opponentId), chronicleBonus: bonusFor(opponentId) } : null,
    stockCount: state.stock.length,
    currentTrick: state.currentTrick,
    leaderId: state.leaderId,
    turnId: state.turnId,
    trickNumber: state.trickNumber,
    promptIndex: state.promptIndex,
    prompt,
    intermissionOpen: state.intermissionOpen ?? false,
    intermissionReadyCount: state.intermissionReady?.length ?? 0,
    youReady: state.intermissionReady?.includes(playerId) ?? false,
    lastWinnerId: state.lastWinnerId,
    lastMessage: state.lastMessage,
    winnerId: state.phase === "finished" && state.matchExit !== "left" ? scoredWinnerId : state.winnerId,
    messages,
    chronicles,
  };
}

async function authenticated(request: Request) {
  const player = await playerByToken(tokenFrom(request));
  if (!player) throw new Error("Your invitation is no longer valid.");
  const room = await roomByCode(new URL(request.url).searchParams.get("code")?.trim() ?? "");
  if (!room || room.id !== player.room_id) throw new Error("That room could not be found.");
  return { player, room, state: JSON.parse(room.state) as GameState };
}

async function archiveRoom(roomId: string, state: GameState) {
  const players = await playersForRoom(roomId);
  const messages = await messagesForRoom(roomId);
  await archiveMatch(roomId, archiveEntries(state, players, messages));
  return players;
}

export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.get("history") === "1") {
      const owner = await playerByHistoryToken(tokenFrom(request));
      if (!owner) throw new Error("Your history book could not be found.");
      const [matches, chronicles] = await Promise.all([archivedMatchesForToken(owner.history_token), chroniclesForRoom(owner.room_id)]);
      return Response.json({ matches, chronicles: chronicles.map((profile) => ({ ...profile, roomId: owner.room_id })) });
    }
    const { player, room, state } = await authenticated(request);
    const [messages, chronicles] = await Promise.all([messagesForRoom(room.id), chroniclesForRoom(room.id)]);
    return Response.json({ state: publicState(state, player.id, messages, chronicles) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The room slipped out of reach." }, { status: 404 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "create") {
      const name = cleanName(body.name);
      if (!name) return Response.json({ error: "Tell the table what to call you." }, { status: 400 });
      const code = await roomCode();
      const roomId = crypto.randomUUID();
      const playerId = crypto.randomUUID();
      const token = crypto.randomUUID();
      const historyToken = crypto.randomUUID();
      const state = initialState(playerId, name);
      await createRoom({ id: roomId, code, phase: state.phase, state: JSON.stringify(state) }, { id: playerId, room_id: roomId, token, history_token: historyToken, name, seat: 0 });
      return Response.json({ code, token, historyToken, state: publicState(state, playerId, []) }, { status: 201 });
    }
    if (action === "join") {
      const name = cleanName(body.name);
      const code = String(body.code ?? "").trim();
      const room = await roomByCode(code, true);
      if (!name || !room) return Response.json({ error: "Check the name and the phrase only you two know." }, { status: 404 });
      const players = await playersForRoom(room.id);
      if (players.length >= 2 || room.phase !== "waiting") return Response.json({ error: "This table already belongs to two people." }, { status: 409 });
      const playerId = crypto.randomUUID();
      const token = crypto.randomUUID();
      const historyToken = crypto.randomUUID();
      const state = JSON.parse(room.state) as GameState;
      beginGame(state, playerId, name);
      await joinRoom(room.id, { id: playerId, room_id: room.id, token, history_token: historyToken, name, seat: 1 }, state);
      return Response.json({ code, token, historyToken, state: publicState(state, playerId, []) });
    }
    const code = String(body.code ?? "").trim();
    const requestWithCode = new Request(`${new URL(request.url).origin}/api/game?code=${encodeURIComponent(code)}`, { headers: request.headers });
    const { player, room, state } = await authenticated(requestWithCode);
    let chronicleAwarded = false;
    if (action === "play") {
      playCard(state, player.id, String(body.cardId ?? ""));
      await saveState(room.id, state);
      if (state.phase === "finished") await archiveRoom(room.id, state);
    } else if (action === "ready") {
      readyFromIntermission(state, player.id);
      await saveState(room.id, state);
    } else if (action === "message") {
      if (state.phase !== "playing") throw new Error("Archived matches are read only.");
      const message = String(body.message ?? "").trim().slice(0, 500);
      if (!message) return Response.json({ error: "Say the thing or let it stay a mystery." }, { status: 400 });
      await addMessage(room.id, player.id, message);
    } else if (action === "chronicle-answer") {
      const questionId = Number(body.questionId);
      if (!chronicleQuestionIds.has(questionId)) return Response.json({ error: "That page is not part of this Chronicle." }, { status: 400 });
      const answer = String(body.answer ?? "").trim().slice(0, 4000);
      if (!answer) return Response.json({ error: "Write something before sealing the page." }, { status: 400 });
      const award = await saveChronicleAnswer(room.id, player.id, questionId, answer);
      chronicleAwarded = award.awardedNow;
    } else if (action === "avatar") {
      const avatarData = String(body.avatarData ?? "");
      if (!/^data:image\/(?:jpeg|png|webp);base64,/i.test(avatarData) || avatarData.length > 350000) return Response.json({ error: "Choose a smaller JPG, PNG, or WebP portrait." }, { status: 400 });
      await savePlayerAvatar(player.id, avatarData);
    } else if (action === "leave") {
      leaveMatch(state, player.id);
      await saveState(room.id, state);
      const players = await archiveRoom(room.id, state);
      await revokeActiveToken(player.id);
      const historyToken = players.find((entry) => entry.id === player.id)?.history_token;
      const messages = await messagesForRoom(room.id);
      return Response.json({ historyToken, state: publicState(state, player.id, messages) });
    } else if (action === "close") {
      closeMatch(state);
      await saveState(room.id, state);
      await archiveRoom(room.id, state);
    } else {
      return Response.json({ error: "That move is not part of this game." }, { status: 400 });
    }
    const [messages, chronicles] = await Promise.all([messagesForRoom(room.id), chroniclesForRoom(room.id)]);
    return Response.json({ historyToken: player.history_token, chronicleAwarded, state: publicState(state, player.id, messages, chronicles) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The cards refused that move." }, { status: 400 });
  }
}
