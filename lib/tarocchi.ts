export type Suit = "Cups" | "Coins" | "Swords" | "Batons" | "Trump";

export type GameCard = {
  id: string;
  suit: Suit;
  rank: number;
  name: string;
  points: number;
};

export type PlayedCard = { playerId: string; card: GameCard };

export type GameState = {
  phase: "waiting" | "playing" | "finished" | "closed";
  playerIds: string[];
  departedIds?: string[];
  matchExit?: "left" | "closed" | null;
  playerNames: Record<string, string>;
  hands: Record<string, GameCard[]>;
  stock: GameCard[];
  captured: Record<string, GameCard[]>;
  currentTrick: PlayedCard[];
  leaderId: string | null;
  turnId: string | null;
  trickNumber: number;
  promptIndex: number;
  intermissionOpen: boolean;
  intermissionReady: string[];
  lastWinnerId: string | null;
  lastMessage: string;
  winnerId: string | null;
};

export type ArchiveMessage = { id: number; body: string; created_at: string; player_id: string; name: string };

const suits: Suit[] = ["Cups", "Coins", "Swords", "Batons"];
const court = ["Ace", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Page", "Knight", "Queen", "King"];
const trumpNames = ["The Magician", "The High Priestess", "The Empress", "The Emperor", "The Hierophant", "The Lovers", "The Chariot", "Justice", "The Hermit", "Fortune", "Strength", "The Hanged One", "Death", "Temperance", "The Devil", "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World"];

export const prompts = [
  "🪽What is something small that makes u feel cared abt to the max?",
  "🪽What did you notice about me before u knew anything about me?",
  "🪽Name a version of us you would be curious to meet one day.",
  "🪽What kind of silence feels good to share with someone?",
  "🪽What is one compliment you have thought but never said out loud to ur sparring partner?",
  "🪽What makes a person stay stuck in ur memory?",
  "🪽Which part of yourself only shows when u feel completely safe?",
  "🪽If this night became a memory what detail would u keep eternal for the rest of time?",
  "🪽What do u think I understand about u without needing an explanation?",
  "🪽Complete this sentence: the world is worth experiencing rn because",
  "🪽top five films or shows?",
  "🪽top one book?",
];

export function createDeck(): GameCard[] {
  const ordinary = suits.flatMap((suit) => court.map((name, i) => ({
    id: `${suit.toLowerCase()}-${i + 1}`,
    suit,
    rank: i + 1,
    name: `${name} of ${suit}`,
    points: i === 13 ? 5 : i === 12 ? 4 : i === 11 ? 3 : i === 10 ? 2 : i === 0 ? 1 : 0,
  })));
  const fool: GameCard = { id: "trump-0", suit: "Trump", rank: 0, name: "The Fool", points: 5 };
  const trumps = trumpNames.map((name, i) => ({
    id: `trump-${i + 1}`,
    suit: "Trump" as const,
    rank: i + 1,
    name: `Trump ${roman(i + 1)} · ${name}`,
    points: i === 20 ? 5 : 1,
  }));
  return [fool, ...ordinary, ...trumps];
}

function roman(n: number) {
  const map: [number, string][] = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [value, glyph] of map) while (n >= value) { out += glyph; n -= value; }
  return out;
}

export function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function initialState(hostId: string, hostName: string): GameState {
  return {
    phase: "waiting", playerIds: [hostId], playerNames: { [hostId]: hostName }, hands: {},
    stock: shuffle(createDeck()), captured: {}, currentTrick: [], leaderId: null, turnId: null,
    trickNumber: 1, promptIndex: 0, intermissionOpen: false, intermissionReady: [], lastWinnerId: null,
    lastMessage: "The table is set. Waiting for your person to arrive.", winnerId: null,
  };
}

export function beginGame(state: GameState, guestId: string, guestName: string) {
  state.playerIds.push(guestId);
  state.playerNames[guestId] = guestName;
  state.hands[state.playerIds[0]] = state.stock.splice(0, 6);
  state.hands[guestId] = state.stock.splice(0, 6);
  state.captured[state.playerIds[0]] = [];
  state.captured[guestId] = [];
  state.phase = "playing";
  state.leaderId = state.playerIds[0];
  state.turnId = state.playerIds[0];
  state.lastMessage = `${state.playerNames[state.playerIds[0]]} leads the first trick.`;
}

export function isLegalPlay(hand: GameCard[], card: GameCard, trick: PlayedCard[]) {
  if (!trick.length) return true;
  if (card.id === "trump-0") return true;
  const led = trick[0].card;
  if (led.id === "trump-0") return true;
  if (led.suit === "Trump") {
    const hasTrump = hand.some((item) => item.suit === "Trump");
    return !hasTrump || card.suit === "Trump";
  }
  const hasSuit = hand.some((item) => item.suit === led.suit);
  if (hasSuit) return card.suit === led.suit;
  const hasTrump = hand.some((item) => item.suit === "Trump");
  return !hasTrump || card.suit === "Trump";
}

function trickWinner(trick: PlayedCard[]) {
  const [first, second] = trick;
  if (first.card.id === "trump-0") return second.playerId;
  if (second.card.id === "trump-0") return first.playerId;
  if (first.card.suit === "Trump" || second.card.suit === "Trump") {
    if (first.card.suit !== "Trump") return second.playerId;
    if (second.card.suit !== "Trump") return first.playerId;
    return first.card.rank >= second.card.rank ? first.playerId : second.playerId;
  }
  if (second.card.suit !== first.card.suit) return first.playerId;
  return first.card.rank >= second.card.rank ? first.playerId : second.playerId;
}

export function playCard(state: GameState, playerId: string, cardId: string) {
  if (state.matchExit) throw new Error("This table is no longer accepting cards.");
  if (state.phase !== "playing") throw new Error("This match is not accepting cards right now.");
  if (state.turnId !== playerId) throw new Error("It is not your turn yet.");
  const hand = state.hands[playerId] ?? [];
  const card = hand.find((item) => item.id === cardId);
  if (!card) throw new Error("That card is not in your hand.");
  if (!isLegalPlay(hand, card, state.currentTrick)) throw new Error("Follow the led suit if you can. If you cannot, play a trump.");
  state.hands[playerId] = hand.filter((item) => item.id !== cardId);
  state.currentTrick.push({ playerId, card });
  if (state.currentTrick.length === 1) {
    state.turnId = state.playerIds.find((id) => id !== playerId) ?? null;
    state.lastMessage = `${state.playerNames[playerId]} has spoken. Your answer is a card.`;
    return;
  }
  const winnerId = trickWinner(state.currentTrick);
  const loserId = state.playerIds.find((id) => id !== winnerId)!;
  for (const played of state.currentTrick) {
    const collector = played.card.id === "trump-0" ? played.playerId : winnerId;
    state.captured[collector].push(played.card);
  }
  state.lastWinnerId = winnerId;
  state.lastMessage = `${state.playerNames[winnerId]} takes the trick. Something more honest has been unlocked.`;
  state.currentTrick = [];
  if (state.stock.length) {
    const firstDraw = state.stock.shift();
    const secondDraw = state.stock.shift();
    if (firstDraw) state.hands[winnerId].push(firstDraw);
    if (secondDraw) state.hands[loserId].push(secondDraw);
  }
  state.promptIndex += 1;
  state.intermissionOpen = true;
  state.intermissionReady = [];
  state.trickNumber += 1;
  if (!state.hands[winnerId].length && !state.hands[loserId].length) {
    const scores = state.playerIds.map((id) => ({ id, score: scoreCards(state.captured[id]) }));
    state.winnerId = scores[0].score === scores[1].score ? null : scores.sort((a, b) => b.score - a.score)[0].id;
    state.phase = "finished";
    state.turnId = null;
    state.leaderId = null;
    state.lastMessage = state.winnerId ? `${state.playerNames[state.winnerId]} wins the cards. Both of you leave with what was revealed.` : "The cards call it even. The night does not.";
  } else {
    state.leaderId = winnerId;
    state.turnId = null;
  }
}

export function leaveMatch(state: GameState, playerId: string) {
  if (state.phase !== "playing" || state.playerIds.length < 2) throw new Error("This table cannot be left right now.");
  if (state.departedIds?.includes(playerId) || state.matchExit) throw new Error("This table is no longer accepting exits.");
  const opponentId = state.playerIds.find((id) => id !== playerId);
  if (!opponentId) throw new Error("Your opponent could not be found.");
  state.departedIds = [playerId];
  state.matchExit = "left";
  state.phase = "finished";
  state.winnerId = opponentId;
  state.intermissionOpen = false;
  state.intermissionReady = [];
  state.turnId = null;
  state.leaderId = null;
  state.lastMessage = `${state.playerNames[playerId]} left the unfinished table. ${state.playerNames[opponentId]} wins by default. Your chat is still here.`;
}

export function closeMatch(state: GameState) {
  if (state.phase === "closed") return;
  state.matchExit = "closed";
  state.phase = "closed";
  state.intermissionOpen = false;
  state.intermissionReady = [];
  state.turnId = null;
  state.leaderId = null;
  state.lastMessage = "The table is closed until next time. Your chat is still here.";
}

export function readyFromIntermission(state: GameState, playerId: string) {
  if (!state.intermissionOpen) return;
  state.intermissionReady = Array.from(new Set([...(state.intermissionReady ?? []), playerId]));
  if (state.intermissionReady.length >= state.playerIds.length) {
    state.intermissionOpen = false;
    state.intermissionReady = [];
    if (state.phase === "playing") state.turnId = state.leaderId;
    state.lastMessage = state.phase === "playing" ? `${state.playerNames[state.leaderId!]} leads the next trick.` : state.lastMessage;
  } else {
    state.lastMessage = `${state.playerNames[playerId]} is ready when you are.`;
  }
}

export function scoreCards(cards: GameCard[] = []) {
  return cards.reduce((sum, card) => sum + card.points, 0);
}

export function archiveEntries(state: GameState, players: { id: string; name: string; history_token: string }[], messages: ArchiveMessage[], archivedAt = new Date().toISOString()) {
  const scoreboard = Object.fromEntries(state.playerIds.map((id) => [state.playerNames[id], scoreCards(state.captured[id])]));
  const promptHistory = prompts.slice(0, state.promptIndex);
  return players.map((player) => {
    const opponent = players.find((candidate) => candidate.id !== player.id);
    const result = state.winnerId === player.id ? "win" : state.winnerId ? "loss" : "draw";
    return {
      id: `${state.playerIds.join("-")}-${player.id}`,
      playerId: player.id,
      historyToken: player.history_token,
      opponentName: opponent?.name ?? "your opponent",
      result: state.matchExit === "left" && state.winnerId === player.id ? "win by forfeit" : result,
      forfeit: state.matchExit === "left",
      scoreboard: JSON.stringify(scoreboard),
      prompts: JSON.stringify(promptHistory),
      messages: JSON.stringify(messages),
      archivedAt,
    };
  });
}
