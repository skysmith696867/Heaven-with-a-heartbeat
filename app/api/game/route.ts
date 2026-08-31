import { addMessage, createRoom, joinRoom, messagesForRoom, playerByToken, playersForRoom, roomByCode, saveState } from "@/lib/game-store";
import { beginGame, initialState, playCard, prompts, readyFromIntermission, scoreCards, type GameState } from "@/lib/tarocchi";

function cleanName(value: unknown) {
  return String(value ?? "").trim().slice(0, 24);
}

const wordBank = ["euphoria whispers", "Heaven sent", "Dance of the fallen stars", "Trace of the secrets", "when time was young and eden was here", "We built this kingdom", "The cards only speak to those who know", "Beep boop bop bop", "Books scream", "Wide eyes", "Sapling of knowledge"];

async function roomCode() {
  const start = Math.floor(Math.random() * wordBank.length);
  for (let offset = 0; offset < wordBank.length; offset += 1) {
    const phrase = wordBank[(start + offset) % wordBank.length];
    if (!(await roomByCode(phrase))) return phrase;
  }
  throw new Error("Every secret phrase is inside another active room. Try again after one of the tables goes quiet.");
}

function tokenFrom(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
}

function publicState(state: GameState, playerId: string, messages: unknown[]) {
  const opponentId = state.playerIds.find((id) => id !== playerId) ?? null;
  const prompt = state.promptIndex > 0 ? prompts[(state.promptIndex - 1) % prompts.length] : null;
  return {
    phase: state.phase,
    you: { id: playerId, name: state.playerNames[playerId], hand: state.hands[playerId] ?? [], score: scoreCards(state.captured[playerId]) },
    opponent: opponentId ? { id: opponentId, name: state.playerNames[opponentId], cardCount: state.hands[opponentId]?.length ?? 0, score: scoreCards(state.captured[opponentId]) } : null,
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
    winnerId: state.winnerId,
    messages,
  };
}

async function authenticated(request: Request) {
  const player = await playerByToken(tokenFrom(request));
  if (!player) throw new Error("Your invitation is no longer valid.");
  const room = await roomByCode(new URL(request.url).searchParams.get("code")?.trim() ?? "");
  if (!room || room.id !== player.room_id) throw new Error("That room could not be found.");
  return { player, room, state: JSON.parse(room.state) as GameState };
}

export async function GET(request: Request) {
  try {
    const { player, room, state } = await authenticated(request);
    const messages = await messagesForRoom(room.id);
    return Response.json({ state: publicState(state, player.id, messages) });
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
      const state = initialState(playerId, name);
      await createRoom({ id: roomId, code, phase: state.phase, state: JSON.stringify(state) }, { id: playerId, room_id: roomId, token, name, seat: 0 });
      return Response.json({ code, token, state: publicState(state, playerId, []) }, { status: 201 });
    }
    if (action === "join") {
      const name = cleanName(body.name);
      const code = String(body.code ?? "").trim();
      const room = await roomByCode(code);
      if (!name || !room) return Response.json({ error: "Check the name and the phrase only you two know." }, { status: 404 });
      const players = await playersForRoom(room.id);
      if (players.length >= 2 || room.phase !== "waiting") return Response.json({ error: "This table already belongs to two people." }, { status: 409 });
      const playerId = crypto.randomUUID();
      const token = crypto.randomUUID();
      const state = JSON.parse(room.state) as GameState;
      beginGame(state, playerId, name);
      await joinRoom(room.id, { id: playerId, room_id: room.id, token, name, seat: 1 }, state);
      return Response.json({ code, token, state: publicState(state, playerId, []) });
    }
    const code = String(body.code ?? "").trim();
    const requestWithCode = new Request(`${new URL(request.url).origin}/api/game?code=${encodeURIComponent(code)}`, { headers: request.headers });
    const { player, room, state } = await authenticated(requestWithCode);
    if (action === "play") {
      playCard(state, player.id, String(body.cardId ?? ""));
      await saveState(room.id, state);
    } else if (action === "ready") {
      readyFromIntermission(state, player.id);
      await saveState(room.id, state);
    } else if (action === "message") {
      const message = String(body.message ?? "").trim().slice(0, 500);
      if (!message) return Response.json({ error: "Say the thing or let it stay a mystery." }, { status: 400 });
      await addMessage(room.id, player.id, message);
    } else {
      return Response.json({ error: "That move is not part of this game." }, { status: 400 });
    }
    const messages = await messagesForRoom(room.id);
    return Response.json({ state: publicState(state, player.id, messages) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The cards refused that move." }, { status: 400 });
  }
}
