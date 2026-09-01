"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Check, Copy, DoorOpen, Heart, LockKeyhole, MessageCircle, MoonStar, Save, ScrollText, Send, Sparkles, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { chronicleQuestions } from "@/lib/chronicle";
import type { GameCard, PlayedCard } from "@/lib/tarocchi";

type Message = { id: number; body: string; created_at: string; player_id: string; name: string };
type ArchivedMatch = { id: string; opponent_name: string; archived_at: string; result: string; forfeit: boolean; scoreboard: Record<string, number>; prompts: string[]; messages: Message[] };
type ChronicleProfile = { playerId: string; name: string; answers: Record<string, string>; awardedQuestionIds: number[]; bonusPoints: number };
const HISTORY_BOOKS_KEY = "past-lives-history-books";
const PLAYER_NAME_KEY = "tarocchi-between-us-player-name";
type ViewState = {
  phase: "waiting" | "playing" | "finished" | "closed";
  matchExit: "left" | "closed" | null;
  you: { id: string; name: string; hand: GameCard[]; score: number; chronicleBonus: number };
  opponent: { id: string; name: string; cardCount: number; score: number; chronicleBonus: number } | null;
  stockCount: number; currentTrick: PlayedCard[]; leaderId: string | null; turnId: string | null;
  trickNumber: number; promptIndex: number; prompt: string | null; lastWinnerId: string | null;
  intermissionOpen: boolean; intermissionReadyCount: number; youReady: boolean;
  lastMessage: string; winnerId: string | null; messages: Message[]; chronicles: ChronicleProfile[];
};
type Session = { code: string; token: string };

const CONSTELLATION_TRACKS = [
  "5jxZBO1efg52vMEmiSjGXy", "1EQ3XbVzPZfKxMjvx9UjBH", "5M4ucOn75aEs8vhqJ9NspE", "3kTJZAWXxTKhd5fv4HajC2", "3lXtnRpxCnn4u1g3KOx3xc", "72zZ3BGaV9CAt00LjFiBVS", "7vWbw3fF1WmPTYWREfV0fG", "27R1A3WZ5Zv0ywNe0Zunfr", "5saEMkYktCU5EtESL5Y7Gz", "410rGaFDJPwjsr9m9RPCkz", "1ElySIlHwm1HX7sUjAZZnp", "2fevWSV5v94Zgm6iW3sQPZ", "6lLEN29GhjXkTI6YUsFdMH", "5gmf93vJq4IFwRP5GnA6oW", "0VF7YLIxSQKyNiFL3X6MmN", "4RjPbpWbPapGuV9mYsqvl6", "7nvIPwXKGhqtRhssxM99kJ", "2kJqNHHGOzLNahukdvlDWN", "2TgxCUZdHFkPEVmFge1OSd", "3ZSmSIn6DRx146aO3l2Zgy", "3JG1uFc40wfyrqaWC7iv0e", "67YPjbcxUypwNOwYBZquq1", "2SSJPqScObwTcz8XffNRaW",
] as const;
type SpotifyController = { loadUri: (uri: string) => void; play: () => void; pause: () => void };
type SpotifyIframeApi = { createController: (element: HTMLElement, options: { uri: string }, callback: (controller: SpotifyController) => void) => void };
declare global { interface Window { SpotifyIframeApi?: SpotifyIframeApi; onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void; } }
const STAR_POSITIONS = [
  { left: "8%", top: "14%", size: "11px" },
  { left: "22%", top: "27%", size: "14px" },
  { left: "38%", top: "11%", size: "12px" },
  { left: "54%", top: "29%", size: "15px" },
  { left: "69%", top: "13%", size: "12px" },
  { left: "82%", top: "25%", size: "14px" },
  { left: "94%", top: "10%", size: "10px" },
  { left: "4%", top: "38%", size: "9px" },
  { left: "4%", top: "54%", size: "12px" },
  { left: "4%", top: "70%", size: "10px" },
  { left: "4%", top: "85%", size: "13px" },
  { left: "96%", top: "39%", size: "11px" },
  { left: "96%", top: "55%", size: "9px" },
  { left: "96%", top: "71%", size: "13px" },
  { left: "96%", top: "86%", size: "10px" },
  { left: "12%", top: "95%", size: "9px" },
  { left: "24%", top: "93%", size: "12px" },
  { left: "37%", top: "96%", size: "10px" },
  { left: "49%", top: "93%", size: "13px" },
  { left: "61%", top: "96%", size: "9px" },
  { left: "73%", top: "93%", size: "12px" },
  { left: "85%", top: "96%", size: "10px" },
  { left: "94%", top: "93%", size: "11px" },
];

function lunarAge(archivedAt: string) {
  const days = (Date.now() - new Date(archivedAt).getTime()) / 86400000;
  if (days < 1) return "tonight";
  if (days < 29.53059) return "within this moon";
  const moons = Math.floor(days / 29.53059);
  return moons === 1 ? "one moon ago" : `${moons} moons ago`;
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function ConstellationMap() {
  const embed = useRef<HTMLDivElement>(null);
  const controller = useRef<SpotifyController | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    let initialized = false;
    const create = (api: SpotifyIframeApi) => {
      if (initialized || controller.current || !embed.current) return;
      initialized = true;
      api.createController(embed.current, { uri: `spotify:track:${CONSTELLATION_TRACKS[0]}` }, (created) => { controller.current = created; });
    };
    if (window.SpotifyIframeApi) create(window.SpotifyIframeApi);
    const previousReady = window.onSpotifyIframeApiReady;
    const ready = (api: SpotifyIframeApi) => { previousReady?.(api); create(api); };
    window.onSpotifyIframeApiReady = ready;
    let script = document.querySelector<HTMLScriptElement>('script[src="https://open.spotify.com/embed/iframe-api/v1"]');
    if (!script) { script = document.createElement("script"); script.src = "https://open.spotify.com/embed/iframe-api/v1"; script.async = true; document.body.appendChild(script); }
    return () => { if (window.onSpotifyIframeApiReady === ready) window.onSpotifyIframeApiReady = previousReady; };
  }, []);
  function selectTrack(index: number) {
    const player = controller.current;
    setSelected((current) => {
      if (!player) return index;
      if (current === index) { if (playing) player.pause(); else player.play(); setPlaying(!playing); return current; }
      player.loadUri(`spotify:track:${CONSTELLATION_TRACKS[index]}`); player.play(); setPlaying(true); return index;
    });
  }
  return <div className="constellation-map" aria-label="Constellation music map">
    <svg className="constellation-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M8 14 L22 27 L38 11 L54 29 L69 13 L82 25 L94 10" /></svg>
    <div className="constellation-orbit orbit-one" /><div className="constellation-orbit orbit-two" />
    <div className="constellation-stars">{STAR_POSITIONS.map((position, index) => <button key={CONSTELLATION_TRACKS[index]} className={`constellation-star ${selected === index ? "is-active" : ""}`} style={{ left: position.left, top: position.top, width: position.size, height: position.size }} onClick={() => selectTrack(index)} aria-label={`Play constellation star ${index + 1}`} aria-pressed={selected === index} />)}</div>
    <div className={`now-playing-relic ${selected === null ? "is-hidden" : ""}`} aria-live="polite"><span className="relic-label">now orbiting</span><div ref={embed} className="spotify-embed" /></div>
  </div>;
}

async function callGame(body: Record<string, unknown>, session?: Session) {
  const response = await fetch("/api/game", { method: "POST", headers: { "content-type": "application/json", ...(session ? { authorization: `Bearer ${session.token}` } : {}) }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "The cards are being difficult.");
  return result;
}

function CardFace({ card, onPlay, disabled, compact = false }: { card: GameCard; onPlay?: () => void; disabled?: boolean; compact?: boolean }) {
  const symbol = card.suit === "Cups" ? "♡" : card.suit === "Coins" ? "✦" : card.suit === "Swords" ? "†" : card.suit === "Batons" ? "♧" : "☾";
  return <button className={`tarocchi-card suit-${card.suit.toLowerCase()} ${compact ? "compact" : ""}`} onClick={onPlay} disabled={!onPlay || disabled} aria-label={`${card.name}, ${card.points} points`}>
    <span className="card-corner">{symbol}</span><span className="card-stars">✦ · ✧ · ✦</span><Heart className="card-heart" aria-hidden="true" />
    <span className="card-center">SKY</span><span className="card-name">{card.name}</span><span className="card-points">{card.points ? `${card.points} point${card.points === 1 ? "" : "s"}` : "play card"}</span>
  </button>;
}

export default function Home() {
  const [mode, setMode] = useState<"welcome" | "join" | "clearance" | "game">("welcome");
  const [name, setName] = useState(""); const [joinCode, setJoinCode] = useState("");
  const [session, setSession] = useState<Session | null>(null); const [game, setGame] = useState<ViewState | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [chatOpen, setChatOpen] = useState(false); const [draft, setDraft] = useState("");
  const [chronicleOpen, setChronicleOpen] = useState(false); const [selectedChronicleId, setSelectedChronicleId] = useState<string | null>(null);
  const [chronicleDrafts, setChronicleDrafts] = useState<Record<string, string>>({}); const [chronicleSaving, setChronicleSaving] = useState<number | null>(null);
  const [chronicleNotice, setChronicleNotice] = useState("");
  const [exitOpen, setExitOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false); const [historyBusy, setHistoryBusy] = useState(false);
  const [history, setHistory] = useState<ArchivedMatch[]>([]); const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (active: Session) => {
    const response = await fetch(`/api/game?code=${encodeURIComponent(active.code)}`, { headers: { authorization: `Bearer ${active.token}` }, cache: "no-store" });
    const result = await response.json(); if (response.ok) setGame(result.state);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const rememberedName = window.localStorage.getItem(PLAYER_NAME_KEY);
      if (rememberedName) setName(rememberedName);
      const saved = window.localStorage.getItem("tarocchi-between-us-session");
      if (!saved) return;
      try {
        const active = JSON.parse(saved) as Session;
        void refresh(active).then(() => { setSession(active); setMode("game"); });
      } catch { window.localStorage.removeItem("tarocchi-between-us-session"); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(() => { if (!session) return; const timer = window.setInterval(() => refresh(session), 1800); return () => window.clearInterval(timer); }, [session, refresh]);
  useEffect(() => { if (chatOpen) chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [chatOpen, game?.messages.length]);
  const chemistry = useMemo(() => Math.min(100, (game?.promptIndex ?? 0) * 8 + Math.min(28, (game?.messages.length ?? 0) * 4)), [game]);

  function rememberHistoryToken(token: string | undefined, code = session?.code) {
    if (!token) return;
    const saved = JSON.parse(window.localStorage.getItem(HISTORY_BOOKS_KEY) ?? "[]") as { code: string; token: string }[];
    const entry = { code: code ?? "", token };
    if (!saved.some((book) => book.token === token)) window.localStorage.setItem(HISTORY_BOOKS_KEY, JSON.stringify([...saved, entry]));
  }

  async function openHistory() {
    setHistoryBusy(true); setError("");
    try {
      const books = JSON.parse(window.localStorage.getItem(HISTORY_BOOKS_KEY) ?? "[]") as { code: string; token: string }[];
      const responses = await Promise.all(books.map(async (book) => {
        const response = await fetch("/api/game?history=1", { headers: { authorization: `Bearer ${book.token}` }, cache: "no-store" });
        return response.ok ? (await response.json()).matches as ArchivedMatch[] : [];
      }));
      setHistory(Array.from(new Map(responses.flat().map((match) => [match.id, match])).values()));
      setHistoryOpen(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The history books stayed closed."); } finally { setHistoryBusy(false); }
  }

  async function enter(action: "create" | "join") {
    setBusy(true); setError("");
    try { const rememberedName = name.trim(); window.localStorage.setItem(PLAYER_NAME_KEY, rememberedName); const result = await callGame({ action, name: rememberedName, code: joinCode }); rememberHistoryToken(result.historyToken, result.code); const next = { code: result.code, token: result.token }; window.localStorage.setItem("tarocchi-between-us-session", JSON.stringify(next)); setSession(next); setGame(result.state); setMode("clearance"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Try that invitation again."); } finally { setBusy(false); }
  }
  async function play(cardId: string) {
    if (!session) return; setBusy(true); setError("");
    try {
      const result = await callGame({ action: "play", code: session.code, cardId }, session); rememberHistoryToken(result.historyToken);
      if (result.state.phase === "finished") window.localStorage.removeItem("tarocchi-between-us-session");
      setGame(result.state);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "That card cannot answer this trick."); } finally { setBusy(false); }
  }
  async function readyFromHeaven() {
    if (!session) return; setBusy(true); setError("");
    try { const result = await callGame({ action: "ready", code: session.code }, session); setGame(result.state); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Heaven asked for one more second."); } finally { setBusy(false); }
  }
  async function sendMessage(event: FormEvent) {
    event.preventDefault(); if (!session || !draft.trim()) return; const message = draft; setDraft("");
    try { const result = await callGame({ action: "message", code: session.code, message }, session); setGame(result.state); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "That message stayed in your thoughts."); setDraft(message); }
  }
  function openChronicles() {
    if (!game) return;
    setSelectedChronicleId((current) => current && game.chronicles.some((profile) => profile.playerId === current) ? current : game.you.id);
    setChronicleDrafts((current) => {
      const next = { ...current };
      for (const profile of game.chronicles) for (const [questionId, answer] of Object.entries(profile.answers)) next[`${profile.playerId}:${questionId}`] = answer;
      return next;
    });
    setChronicleOpen(true);
  }
  async function saveChroniclePage(questionId: number) {
    if (!session || !game) return;
    const answer = chronicleDrafts[`${game.you.id}:${questionId}`]?.trim() ?? "";
    if (!answer) { setError("Write something before sealing the page."); return; }
    setChronicleSaving(questionId); setError("");
    try { const result = await callGame({ action: "chronicle-answer", code: session.code, questionId, answer }, session); setGame(result.state); setChronicleNotice(result.chronicleAwarded ? "+5 points · your answer crossed 50 words" : "entry recorded privately"); window.setTimeout(() => setChronicleNotice(""), 3500); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "That page refused to stay written."); }
    finally { setChronicleSaving(null); }
  }
  async function recordIntermissionPage(questionId: number) {
    if (!session || !game) return;
    const answer = chronicleDrafts[`${game.you.id}:${questionId}`]?.trim() ?? "";
    if (!answer) { setError("Write something before sealing the page."); return; }
    setChronicleSaving(questionId); setError("");
    try {
      const recorded = await callGame({ action: "chronicle-answer", code: session.code, questionId, answer }, session);
      const returned = await callGame({ action: "ready", code: session.code }, session);
      setGame(returned.state);
      setChronicleNotice(recorded.chronicleAwarded ? "+5 points · your answer crossed 50 words" : "entry added to your Chronicle Archive");
      window.setTimeout(() => setChronicleNotice(""), 3500);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The Chronicle refused to turn the page."); }
    finally { setChronicleSaving(null); }
  }
  async function exitMatch(action: "leave" | "close") {
    if (!session) return; setBusy(true); setError("");
    try {
      const result = await callGame({ action, code: session.code }, session); rememberHistoryToken(result.historyToken);
      window.localStorage.removeItem("tarocchi-between-us-session"); setGame(result.state); setExitOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The table could not close just yet."); } finally { setBusy(false); }
  }
  function returnToLobby() {
    window.localStorage.removeItem("tarocchi-between-us-session"); setSession(null); setGame(null); setMode("welcome");
  }
  let screen: ReactNode;
  if (mode === "clearance" && game && session) screen = <main className="lobby-shell clearance-shell">
    <div className="aurora aurora-one" /><div className="aurora aurora-two" />
    <section className="clearance-card">
      <div className="agent-seal"><LockKeyhole /><span>SKY</span></div>
      <p className="eyebrow">identity confirmed</p>
      <h1>congratulations secret agent ur in the one the only casino of star spending.</h1>
      <p className="welcome-home">Welcome home.</p>
      <p className="clearance-code">something only we know<br /><strong>{session.code}</strong></p>
      <Button onClick={() => setMode("game")} className="primary-romance">enter the casino <Sparkles /></Button>
    </section>
  </main>;

  else if (mode !== "game" || !game || !session) screen = <main className="lobby-shell">
    <div className="aurora aurora-one" /><div className="aurora aurora-two" />
    <section className="lobby-card">
      <div className="tiny-mark"><MoonStar size={15} /> a private table for two</div>
      <div className="heart-orbit"><Heart fill="currentColor" /><span>✦</span><span>✧</span><span>✦</span></div>
      <p className="eyebrow">tarocchi between us</p><h1>the cards are only<br />an excuse to look closer</h1>
      <p className="intro">Two players. One secret room.</p>
      <div className="consent-note"><Sparkles size={17} /><p>this game is dangerous and safe simultaneously. good luck strong warrior. ur sparring partner sky is happy ur here </p></div>
      <label className="field-label" htmlFor="name">what should the cards call you?</label>
      <Input id="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="your name" className="romance-input" maxLength={24} />
      <p className="remembered-name-note">remembered on this device · change it here whenever you like</p>
      {mode === "join" && <><label className="field-label" htmlFor="code">something only we know.</label><Input id="code" value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="type your secret phrase" className="romance-input code-input" maxLength={60} autoCapitalize="none" autoCorrect="off" /></>}
      {error && <p className="error-note">{error}</p>}
      <div className="lobby-actions">{mode === "welcome" ? <>
        <Button onClick={() => enter("create")} disabled={busy || !name.trim()} className="primary-romance"><Heart size={16} /> create our table</Button>
        <Button onClick={() => { setMode("join"); setError(""); }} variant="ghost" className="ghost-romance"><UsersRound size={16} /> i have a secret code</Button>
      </> : <><Button onClick={() => enter("join")} disabled={busy || !name.trim() || !joinCode.trim()} className="primary-romance"><LockKeyhole size={16} /> enter their orbit</Button><Button onClick={() => setMode("welcome")} variant="ghost" className="ghost-romance">go back</Button></>}</div>
      {mode === "welcome" && <Button onClick={openHistory} disabled={historyBusy} variant="ghost" className="history-button"><BookOpen size={16} /> our past lives (the legends history books hold)</Button>}
      {historyOpen && <section className="history-overlay" role="dialog" aria-modal="true" aria-labelledby="history-title"><div className="history-dialog"><button className="exit-close" onClick={() => setHistoryOpen(false)} aria-label="Close"><X size={18} /></button><p className="eyebrow">the archive</p><h2 id="history-title">legends of our time</h2>{!history.length && <p className="history-empty">No past lives have been written here yet.</p>}{history.map((match) => <article className="history-entry" key={match.id}><button onClick={() => setSelectedHistory(selectedHistory === match.id ? null : match.id)}><span>{match.opponent_name}</span><strong>{match.result}</strong><small>{new Date(match.archived_at).toLocaleDateString()} · {lunarAge(match.archived_at)}</small></button>{selectedHistory === match.id && <div className="history-detail"><p><strong>scoreboard</strong> {Object.entries(match.scoreboard).map(([player, score]) => `${player}: ${score}`).join(" · ")}</p><p><strong>prompts</strong> {match.prompts.length ? match.prompts.join(" / ") : "none"}</p><div className="history-messages">{match.messages.map((message) => <div className="message-bubble" key={message.id}><span>{message.name}</span><p>{message.body}</p></div>)}</div></div>}</article>)}</div></section>}
    </section>
  </main>;

  if (mode !== "game" || !game || !session) return <><ConstellationMap />{screen}</>;
  const isYourTurn = game.turnId === game.you.id;
  const unseen = game.messages.filter((message) => message.player_id !== game.you.id).length;
  const selectedChronicle = game.chronicles.find((profile) => profile.playerId === selectedChronicleId) ?? game.chronicles.find((profile) => profile.playerId === game.you.id) ?? { playerId: game.you.id, name: game.you.name, answers: {}, awardedQuestionIds: [], bonusPoints: 0 };
  const selectedChronicleCount = Object.values(selectedChronicle.answers).filter((answer) => answer.trim()).length;
  const canEditChronicle = selectedChronicle.playerId === game.you.id;
  const intermissionQuestion = chronicleQuestions[(Math.max(1, game.promptIndex) - 1) % chronicleQuestions.length];
  const intermissionDraftKey = `${game.you.id}:${intermissionQuestion.id}`;
  const intermissionAnswer = chronicleDrafts[intermissionDraftKey] ?? game.chronicles.find((profile) => profile.playerId === game.you.id)?.answers[String(intermissionQuestion.id)] ?? "";
  const intermissionWords = wordCount(intermissionAnswer);
  screen = <main className="game-shell"><div className="game-aurora" />
    <header className="game-header"><div><p className="eyebrow">tarocchi between us</p><h1 className="player-marquee"><Heart className="header-heart first-heart" fill="currentColor" /><span className="player-neon first-player">{game.you.name}</span><i>&</i><span className="player-neon second-player">{game.opponent?.name ?? "the one you invited"}</span><Heart className="header-heart second-heart" fill="currentColor" /></h1></div><div className="header-actions"><div className="room-chip"><LockKeyhole size={13} /> room {session.code}<button onClick={() => navigator.clipboard.writeText(session.code)} aria-label="Copy room code"><Copy size={14} /></button></div><button className="exit-trigger" onClick={() => setExitOpen(true)} aria-label="Leave or close match"><DoorOpen size={17} /></button></div></header>
    <section className="chemistry-strip" aria-label={`Friendship core is ${chemistry} percent`}><div><span>friendship core</span><strong>{chemistry < 25 ? "warming up" : chemistry < 60 ? "in sync" : chemistry < 90 ? "inner circle" : "friendship legendary"}</strong></div><Progress value={chemistry} className="chemistry-progress" /><Heart size={18} fill="currentColor" /></section>
    {game.phase === "waiting" ? <section className="waiting-table"><div className="card-back waiting-back"><Heart /><span>SKY</span></div><p className="eyebrow">the table is waiting</p><h2>send this code to the person you would rather be here with</h2><button className="giant-code" onClick={() => navigator.clipboard.writeText(session.code)}>{session.code} <Copy size={20} /></button><p>The cards will deal themselves when they arrive.</p></section> : game.matchExit ? <section className="ending-card"><p className="eyebrow">{game.matchExit === "closed" ? "the table is closed" : "the table is unfinished"}</p><h2>{game.matchExit === "closed" ? "until next time" : "they left the table"}</h2><p>{game.lastMessage}</p><div className="ending-actions"><Button onClick={() => setChatOpen(true)} className="primary-romance">keep talking</Button><Button onClick={returnToLobby} variant="outline" className="ready-button">back to the beginning of time</Button></div><span className="chat-kept">this room and every message will still be here when you return</span></section> : <>
      <section className="status-row"><div><span>{game.opponent?.name}</span><strong>{game.opponent?.cardCount ?? 0} cards · {game.opponent?.score ?? 0} points</strong></div><p>{game.lastMessage}</p><div className="align-right"><span>trick {game.trickNumber}</span><strong>{game.stockCount} in the stock</strong></div></section>
      <section className="table-area"><div className="opponent-hand" aria-label="Opponent cards">{Array.from({ length: Math.min(8, game.opponent?.cardCount ?? 0) }, (_, i) => <div className="mini-back" key={i}><Heart size={13} /></div>)}</div><div className="trick-stage">{game.currentTrick.length ? game.currentTrick.map(({ playerId, card }) => <div className="played-slot" key={`${playerId}-${card.id}`}><span>{playerId === game.you.id ? "you" : game.opponent?.name}</span><CardFace card={card} compact /></div>) : <div className="empty-trick"><Heart /><p>{isYourTurn ? "lead with a card" : `waiting for ${game.opponent?.name}`}</p></div>}</div></section>
      {game.phase === "finished" ? <section className="ending-card"><p className="eyebrow">the final trick</p><h2>{game.winnerId === game.you.id ? "you won the cards" : game.winnerId ? `${game.opponent?.name} won the cards` : "the cards call it even"}</h2><p>Winning was never the dangerous part. Being honest was.</p><div className="ending-actions"><Button onClick={() => setChatOpen(true)} className="primary-romance">keep talking</Button><Button onClick={returnToLobby} variant="outline" className="ready-button">back to the beginning of time</Button></div><span className="chat-kept">this room and every message will still be here when you return</span></section> : <section className="your-hand"><div className="hand-heading"><div><p className="eyebrow">your hand</p><h2>{isYourTurn ? "your move, beautiful" : "watch what they reveal"}</h2></div><span>{game.you.score} points captured</span></div>{error && <p className="error-note">{error}</p>}<div className="cards-scroll">{game.you.hand.map((card) => <CardFace key={card.id} card={card} onPlay={() => play(card.id)} disabled={!isYourTurn || busy} />)}</div></section>}
    </>}
    <button className="chronicle-orbit" onClick={openChronicles} aria-label="Open Chronicle Archive"><ScrollText /><span>chronicle archive</span></button>
    {chronicleNotice && !chronicleOpen && <p className="global-chronicle-notice">{chronicleNotice}</p>}
    <Sheet open={chronicleOpen} onOpenChange={setChronicleOpen}><SheetContent className="chronicle-sheet"><SheetHeader className="chronicle-header"><p className="eyebrow">private human archive</p><SheetTitle>The Chronicles of {selectedChronicle.name}</SheetTitle><SheetDescription>Only the two people in this room can read these pages. Each player may write only in their own Chronicle.</SheetDescription></SheetHeader><div className="chronicle-rule"><Sparkles /><p><strong>Write 50 or more words to earn +5 game points.</strong><span>The bonus is awarded once per question. Thoughtfulness has loot now.</span></p></div><div className="chronicle-profile-tabs">{game.chronicles.map((profile) => <button key={profile.playerId} className={profile.playerId === selectedChronicle.playerId ? "is-active" : ""} onClick={() => setSelectedChronicleId(profile.playerId)}>{profile.name}{profile.playerId === game.you.id ? " · you" : ""}</button>)}</div><div className="chronicle-progress"><span>{selectedChronicleCount} entries recorded · +{selectedChronicle.bonusPoints} points</span><strong>{Math.max(0, chronicleQuestions.length - selectedChronicleCount)} still unknown</strong><Progress value={(selectedChronicleCount / chronicleQuestions.length) * 100} /></div>{chronicleNotice && <p className="chronicle-notice">{chronicleNotice}</p>}{error && <p className="error-note">{error}</p>}<div className="chronicle-pages">{(["Known Data", "Inner Worlds"] as const).map((collection) => <section key={collection} className="chronicle-volume"><div className="chronicle-volume-title"><span>{collection === "Known Data" ? "I" : "II"}</span><div><p>volume</p><h3>{collection}</h3></div></div>{chronicleQuestions.filter((question) => question.collection === collection).map((question) => { const savedAnswer = selectedChronicle.answers[String(question.id)] ?? ""; const draftKey = `${selectedChronicle.playerId}:${question.id}`; const displayedAnswer = chronicleDrafts[draftKey] ?? savedAnswer; const words = wordCount(displayedAnswer); const bonusEarned = selectedChronicle.awardedQuestionIds.includes(question.id); return <article key={question.id} className={`chronicle-page ${savedAnswer ? "is-recorded" : ""} ${bonusEarned ? "earned-bonus" : ""}`}><div className="chronicle-question"><span>{String(question.id).padStart(2, "0")}</span><p>{question.prompt}</p></div>{canEditChronicle ? <><Textarea value={displayedAnswer} onChange={(event) => setChronicleDrafts((current) => ({ ...current, [draftKey]: event.target.value }))} placeholder="write your answer here..." maxLength={4000} /><div className="chronicle-answer-status"><span className={words >= 50 || bonusEarned ? "is-complete" : ""}>{words} / 50 words</span>{bonusEarned && <strong><Sparkles /> +5 points earned</strong>}</div><Button onClick={() => saveChroniclePage(question.id)} disabled={chronicleSaving === question.id || !displayedAnswer.trim()} className="chronicle-save">{savedAnswer && displayedAnswer.trim() === savedAnswer ? <Check /> : <Save />}{chronicleSaving === question.id ? "sealing..." : savedAnswer ? "update entry" : "record entry"}</Button></> : savedAnswer ? <><p className="chronicle-answer">{savedAnswer}</p><div className="chronicle-answer-status"><span>{wordCount(savedAnswer)} words</span>{bonusEarned && <strong><Sparkles /> +5 points earned</strong>}</div></> : <p className="chronicle-unknown">??? · entry undiscovered</p>}</article>; })}</section>)}</div></SheetContent></Sheet>
    <Sheet open={chatOpen} onOpenChange={setChatOpen}><SheetTrigger asChild><button className="chat-orbit" aria-label="Open private chat"><MessageCircle /><span>between us</span>{unseen > 0 && <b>{Math.min(9, unseen)}</b>}</button></SheetTrigger><SheetContent className="chat-sheet"><SheetHeader className="chat-header"><SheetTitle>between us</SheetTitle><SheetDescription>Only the two people at this table can read this room. The chat stays here after the last trick.</SheetDescription></SheetHeader><div className="messages-list">{!game.messages.length && <div className="first-message"><Heart /><p>Someone has to risk saying the first honest thing.</p></div>}{game.messages.map((message) => <div key={message.id} className={`message-bubble ${message.player_id === game.you.id ? "mine" : "theirs"}`}><span>{message.player_id === game.you.id ? "you" : message.name}</span><p>{message.body}</p></div>)}<div ref={chatEnd} /></div>{game.phase === "playing" && !game.matchExit && <form onSubmit={sendMessage} className="chat-compose"><Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="say what the card made you think..." maxLength={500} aria-label="Private message" /><Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message"><Send /></Button></form>}</SheetContent></Sheet>
    {game.intermissionOpen && <section className="intermission-overlay chronicle-intermission" role="dialog" aria-modal="true" aria-labelledby="intermission-title"><div className="intermission-stars">✦　📖　✧</div><p className="eyebrow">a page appears between the cards</p><h2 id="intermission-title">The Chronicles of {game.you.name}</h2><div className="intermission-entry-number">entry {String(intermissionQuestion.id).padStart(2, "0")} · {intermissionQuestion.collection}</div><p className="intermission-question">{intermissionQuestion.prompt}</p>{game.youReady ? <div className="chronicle-waiting"><Check /><p>Your answer is sealed in the Archive.</p><strong>Waiting for {game.opponent?.name} to finish their page…</strong></div> : <><Textarea value={intermissionAnswer} onChange={(event) => setChronicleDrafts((current) => ({ ...current, [intermissionDraftKey]: event.target.value }))} placeholder="write directly into your Chronicle..." maxLength={4000} className="intermission-answer" /><div className="intermission-word-reward"><span className={intermissionWords >= 50 ? "is-complete" : ""}>{intermissionWords} / 50 words</span><strong><Sparkles /> 50+ words earns 5 points</strong></div><div className="intermission-actions"><Button onClick={() => recordIntermissionPage(intermissionQuestion.id)} disabled={busy || chronicleSaving === intermissionQuestion.id || !intermissionAnswer.trim()} className="primary-romance"><BookOpen /> record answer & return to cards</Button><button onClick={readyFromHeaven} disabled={busy} className="skip-question">leave this page unknown</button></div></>}<p className="ready-count">{game.intermissionReadyCount} of 2 pages sealed</p></section>}
    {exitOpen && <section className="exit-overlay" role="dialog" aria-modal="true" aria-labelledby="exit-title"><div className="exit-dialog"><button className="exit-close" onClick={() => setExitOpen(false)} aria-label="Close"><X size={18} /></button><p className="eyebrow">a quiet choice</p><h2 id="exit-title">do u want to leave this unfinished?</h2><div className="exit-actions"><Button onClick={() => exitMatch("leave")} disabled={busy} className="primary-romance">leave without me and let opponent win by default</Button><Button onClick={() => exitMatch("close")} disabled={busy} variant="outline" className="ready-button">close our table until next time</Button></div></div></section>}
  </main>;
  return <><ConstellationMap />{screen}</>;
}
