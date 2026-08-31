import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

const game = await vite.ssrLoadModule("/lib/tarocchi.ts");
test.after(() => vite.close());

function players() {
  return [
    { id: "host", name: "Sky", history_token: "history-sky" },
    { id: "guest", name: "Moon", history_token: "history-moon" },
  ];
}

test("forfeit finishes the match and archives both players with complete chat", () => {
  const state = game.initialState("host", "Sky");
  game.beginGame(state, "guest", "Moon");
  state.promptIndex = 2;
  game.leaveMatch(state, "host");

  const messages = [{ id: 1, body: "stay a little longer", created_at: "2026-08-31", player_id: "host", name: "Sky" }];
  const entries = game.archiveEntries(state, players(), messages, "2026-08-31T12:00:00.000Z");

  assert.equal(state.phase, "finished");
  assert.equal(state.winnerId, "guest");
  assert.deepEqual(state.departedIds, ["host"]);
  assert.equal(entries.length, 2);
  assert.equal(entries.find((entry) => entry.playerId === "guest").result, "win by forfeit");
  assert.equal(entries[0].messages, JSON.stringify(messages));
  assert.deepEqual(JSON.parse(entries[0].prompts), game.prompts.slice(0, 2));
});

test("closing a table archives a read-only draw for both players", () => {
  const state = game.initialState("host", "Sky");
  game.beginGame(state, "guest", "Moon");
  state.phase = "finished";
  state.winnerId = null;
  game.closeMatch(state);

  const entries = game.archiveEntries(state, players(), [], "2026-08-31T12:00:00.000Z");

  assert.equal(state.phase, "closed");
  assert.equal(state.matchExit, "closed");
  assert.equal(entries.every((entry) => entry.result === "draw"), true);
  assert.equal(entries.every((entry) => entry.forfeit === false), true);
  assert.equal(entries.every((entry) => entry.opponentName), true);
});

test("completed matches archive the winner and scoreboard without changing chat", () => {
  const state = game.initialState("host", "Sky");
  game.beginGame(state, "guest", "Moon");
  state.phase = "finished";
  state.winnerId = "host";
  state.captured.host = [{ points: 5 }];
  state.captured.guest = [{ points: 1 }];
  const messages = [{ id: 2, body: "we made it", created_at: "2026-08-31", player_id: "guest", name: "Moon" }];

  const entries = game.archiveEntries(state, players(), messages);

  assert.equal(entries.find((entry) => entry.playerId === "host").result, "win");
  assert.deepEqual(JSON.parse(entries[0].scoreboard), { Sky: 5, Moon: 1 });
  assert.deepEqual(JSON.parse(entries[0].messages), messages);
});