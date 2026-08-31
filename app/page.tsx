"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Copy, DoorOpen, Heart, LockKeyhole, MessageCircle, MoonStar, Send, Sparkles, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { GameCard, PlayedCard } from "@/lib/tarocchi";

type Message = { id: number; body: string; created_at: string; player_id: string; name: string };
type ArchivedMatch = { id: string; opponent_name: string; archived_at: string; result: string; forfeit: boolean; scoreboard: Record<string, number>; prompts: string[]; messages: Message[] };
const HISTORY_BOOKS_KEY = "past-lives-history-books";
type ViewState = {
  phase: "waiting" | "playing" | "finished" | "closed";
  matchExit: "left" | "closed" | null;
  you: { id: string; name: string; hand: GameCard[]; score: number };
  opponent: { id: string; name: string; cardCount: number; score: number } | null;
  stockCount: number; currentTrick: PlayedCard[]; leaderId: string | null; turnId: string | null;
  trickNumber: number; promptIndex: number; prompt: string | null; lastWinnerId: string | null;
  intermissionOpen: boolean; intermissionReadyCount: number; youReady: boolean;
  lastMessage: string; winnerId: string | null; messages: Message[];
};
type Session = { code: string; token: string };

const CONSTELLATION_TRACKS = [
  "5jxZBO1efg52vMEmiSjGXy", "1EQ3XbVzPZfKxMjvx9UjBH", "5M4ucOn75aEs8vhqJ9NspE", "3kTJZAWXxTKhd5fv4HajC2", "3lXtnRpxCnn4u1g3KOx3xc", "72zZ3BGaV9CAt00LjFiBVS", "7vWbw3fF1WmPTYWREfV0fG", "27R1A3WZ5Zv0ywNe0Zunfr", "5saEMkYktCU5EtESL5Y7Gz", "410rGaFDJPwjsr9m9RPCkz", "1ElySIlHwm1HX7sUjAZZnp", "2fevWSV5v94Zgm6iW3sQPZ", "6lLEN29GhjXkTI6YUsFdMH", "5gmf93vJq4IFwRP5GnA6oW", "0VF7YLIxSQKyNiFL3X6MmN", "4RjPbpWbPapGuV9mYsqvl6", "7nvIPwXKGhqtRhssxM99kJ", "2kJqNHHGOzLNahukdvlDWN", "2TgxCUZdHFkPEVmFge1OSd", "3ZSmSIn6DRx146aO3l2Zgy", "3JG1uFc40wfyrqaWC7iv0e", "67YPjbcxUypwNOwYBZquq1", "2SSJPqScObwTcz8XffNRaW",
] as const;
type SpotifyController = { loadUri: (uri: string) => void; play: () => void; pause: () => void };
type SpotifyIframeApi = { createController: (element: HTMLElement, options: { uri: string }, callback: (controller: SpotifyController) => void) => void };
declare global { interface Window { SpotifyIframeApi?: SpotifyIframeApi; onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void; } }
const STAR_POSITIONS = CONSTELLATION_TRACKS.map((_, index) => ({ left: `${8 + ((index * 37) % 84)}%`, top: `${10 + ((index * 61) % 78)}%`, size: `${8 + (index % 4) * 3}px` }));

function lunarAge(archivedAt: string) {
  const days = (Date.now() - new Date(archivedAt).getTime()) / 86400000;
  if (days < 1) return "tonight";
  if (days < 29.53059) return "within this moon";
  const moons = Math.floor(days / 29.53059);
  return moons === 1 ? "one moon ago" : `${moons} moons ago`;
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
    <svg className="constellation-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M8 18 L30 42 L49 16 L68 55 L92 27 M12 77 L35 61 L57 88 L77 64 L94 82 M30 42 L35 61 M68 55 L77 64" /></svg>
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
    try { const result = await callGame({ action, name, code: joinCode }); rememberHistoryToken(result.historyToken, result.code); const next = { code: result.code, token: result.token }; window.localStorage.setItem("tarocchi-between-us-session", JSON.stringify(next)); setSession(next); setGame(result.state); setMode("clearance"); }
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

  const isYourTurn = game.turnId === game.you.id;
  const unseen = game.messages.filter((message) => message.player_id !== game.you.id).length;
  screen = <main className="game-shell"><div className="game-aurora" />
    <header className="game-header"><div><p className="eyebrow">tarocchi between us</p><h1>{game.you.name} <span>&</span> {game.opponent?.name ?? "the one you invited"}</h1></div><div className="header-actions"><div className="room-chip"><LockKeyhole size={13} /> room {session.code}<button onClick={() => navigator.clipboard.writeText(session.code)} aria-label="Copy room code"><Copy size={14} /></button></div><button className="exit-trigger" onClick={() => setExitOpen(true)} aria-label="Leave or close match"><DoorOpen size={17} /></button></div></header>
    <section className="chemistry-strip" aria-label={`Friendship core is ${chemistry} percent`}><div><span>friendship core</span><strong>{chemistry < 25 ? "warming up" : chemistry < 60 ? "in sync" : chemistry < 90 ? "inner circle" : "friendship legendary"}</strong></div><Progress value={chemistry} className="chemistry-progress" /><Heart size={18} fill="currentColor" /></section>
    {game.phase === "waiting" ? <section className="waiting-table"><div className="card-back waiting-back"><Heart /><span>SKY</span></div><p className="eyebrow">the table is waiting</p><h2>send this code to the person you would rather be here with</h2><button className="giant-code" onClick={() => navigator.clipboard.writeText(session.code)}>{session.code} <Copy size={20} /></button><p>The cards will deal themselves when they arrive.</p></section> : game.matchExit ? <section className="ending-card"><p className="eyebrow">{game.matchExit === "closed" ? "the table is closed" : "the table is unfinished"}</p><h2>{game.matchExit === "closed" ? "until next time" : "they left the table"}</h2><p>{game.lastMessage}</p><div className="ending-actions"><Button onClick={() => setChatOpen(true)} className="primary-romance">keep talking</Button><Button onClick={returnToLobby} variant="outline" className="ready-button">back to the beginning of time</Button></div><span className="chat-kept">this room and every message will still be here when you return</span></section> : <>
      <section className="status-row"><div><span>{game.opponent?.name}</span><strong>{game.opponent?.cardCount ?? 0} cards · {game.opponent?.score ?? 0} points</strong></div><p>{game.lastMessage}</p><div className="align-right"><span>trick {game.trickNumber}</span><strong>{game.stockCount} in the stock</strong></div></section>
      {game.prompt && <section className="reveal-card"><div className="reveal-number">reveal {game.promptIndex}</div><Sparkles size={22} /><p>{game.prompt}</p><button onClick={() => setChatOpen(true)}>answer where only they can see <MessageCircle size={15} /></button></section>}
      <section className="table-area"><div className="opponent-hand" aria-label="Opponent cards">{Array.from({ length: Math.min(8, game.opponent?.cardCount ?? 0) }, (_, i) => <div className="mini-back" key={i}><Heart size={13} /></div>)}</div><div className="trick-stage">{game.currentTrick.length ? game.currentTrick.map(({ playerId, card }) => <div className="played-slot" key={`${playerId}-${card.id}`}><span>{playerId === game.you.id ? "you" : game.opponent?.name}</span><CardFace card={card} compact /></div>) : <div className="empty-trick"><Heart /><p>{isYourTurn ? "lead with a card" : `waiting for ${game.opponent?.name}`}</p></div>}</div></section>
      {game.phase === "finished" ? <section className="ending-card"><p className="eyebrow">the final trick</p><h2>{game.winnerId === game.you.id ? "you won the cards" : game.winnerId ? `${game.opponent?.name} won the cards` : "the cards call it even"}</h2><p>Winning was never the dangerous part. Being honest was.</p><div className="ending-actions"><Button onClick={() => setChatOpen(true)} className="primary-romance">keep talking</Button><Button onClick={returnToLobby} variant="outline" className="ready-button">back to the beginning of time</Button></div><span className="chat-kept">this room and every message will still be here when you return</span></section> : <section className="your-hand"><div className="hand-heading"><div><p className="eyebrow">your hand</p><h2>{isYourTurn ? "your move, beautiful" : "watch what they reveal"}</h2></div><span>{game.you.score} points captured</span></div>{error && <p className="error-note">{error}</p>}<div className="cards-scroll">{game.you.hand.map((card) => <CardFace key={card.id} card={card} onPlay={() => play(card.id)} disabled={!isYourTurn || busy} />)}</div></section>}
    </>}
    <Sheet open={chatOpen} onOpenChange={setChatOpen}><SheetTrigger asChild><button className="chat-orbit" aria-label="Open private chat"><MessageCircle /><span>between us</span>{unseen > 0 && <b>{Math.min(9, unseen)}</b>}</button></SheetTrigger><SheetContent className="chat-sheet"><SheetHeader className="chat-header"><SheetTitle>between us</SheetTitle><SheetDescription>Only the two people at this table can read this room. The chat stays here after the last trick.</SheetDescription></SheetHeader><div className="messages-list">{!game.messages.length && <div className="first-message"><Heart /><p>Someone has to risk saying the first honest thing.</p></div>}{game.messages.map((message) => <div key={message.id} className={`message-bubble ${message.player_id === game.you.id ? "mine" : "theirs"}`}><span>{message.player_id === game.you.id ? "you" : message.name}</span><p>{message.body}</p></div>)}<div ref={chatEnd} /></div>{game.phase === "playing" && !game.matchExit && <form onSubmit={sendMessage} className="chat-compose"><Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="say what the card made you think..." maxLength={500} aria-label="Private message" /><Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message"><Send /></Button></form>}</SheetContent></Sheet>
    {game.intermissionOpen && game.prompt && <section className="intermission-overlay" role="dialog" aria-modal="true" aria-labelledby="intermission-title"><div className="intermission-stars">✦　🪽　✧</div><p className="eyebrow">the cards are taking a breath</p><h2 id="intermission-title">intermission from heaven</h2><p className="intermission-question">{game.prompt}</p><div className="intermission-actions"><Button onClick={() => setChatOpen(true)} className="primary-romance"><MessageCircle /> answer between us</Button><Button onClick={readyFromHeaven} disabled={busy || game.youReady} variant="outline" className="ready-button">{game.youReady ? `waiting for ${game.opponent?.name}` : "we answered. return to the cards"}</Button><button onClick={readyFromHeaven} disabled={busy || game.youReady} className="skip-question">skip this question</button></div><p className="ready-count">{game.intermissionReadyCount} of 2 ready to return</p></section>}
    {exitOpen && <section className="exit-overlay" role="dialog" aria-modal="true" aria-labelledby="exit-title"><div className="exit-dialog"><button className="exit-close" onClick={() => setExitOpen(false)} aria-label="Close"><X size={18} /></button><p className="eyebrow">a quiet choice</p><h2 id="exit-title">do u want to leave this unfinished?</h2><div className="exit-actions"><Button onClick={() => exitMatch("leave")} disabled={busy} className="primary-romance">leave without me and let opponent win by default</Button><Button onClick={() => exitMatch("close")} disabled={busy} variant="outline" className="ready-button">close our table until next time</Button></div></div></section>}
  </main>;
  return <><ConstellationMap />{screen}</>;
}
