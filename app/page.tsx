"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Heart, LockKeyhole, MessageCircle, MoonStar, Send, Sparkles, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { GameCard, PlayedCard } from "@/lib/tarocchi";

type Message = { id: number; body: string; created_at: string; player_id: string; name: string };
type ViewState = {
  phase: "waiting" | "playing" | "finished";
  you: { id: string; name: string; hand: GameCard[]; score: number };
  opponent: { id: string; name: string; cardCount: number; score: number } | null;
  stockCount: number; currentTrick: PlayedCard[]; leaderId: string | null; turnId: string | null;
  trickNumber: number; promptIndex: number; prompt: string | null; lastWinnerId: string | null;
  intermissionOpen: boolean; intermissionReadyCount: number; youReady: boolean;
  lastMessage: string; winnerId: string | null; messages: Message[];
};
type Session = { code: string; token: string };

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

  async function enter(action: "create" | "join") {
    setBusy(true); setError("");
    try { const result = await callGame({ action, name, code: joinCode }); const next = { code: result.code, token: result.token }; window.localStorage.setItem("tarocchi-between-us-session", JSON.stringify(next)); setSession(next); setGame(result.state); setMode("clearance"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Try that invitation again."); } finally { setBusy(false); }
  }
  async function play(cardId: string) {
    if (!session) return; setBusy(true); setError("");
    try { const result = await callGame({ action: "play", code: session.code, cardId }, session); setGame(result.state); }
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
  if (mode === "clearance" && game && session) return <main className="lobby-shell clearance-shell">
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

  if (mode !== "game" || !game || !session) return <main className="lobby-shell">
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
    </section>
  </main>;

  const isYourTurn = game.turnId === game.you.id;
  const unseen = game.messages.filter((message) => message.player_id !== game.you.id).length;
  return <main className="game-shell"><div className="game-aurora" />
    <header className="game-header"><div><p className="eyebrow">tarocchi between us</p><h1>{game.you.name} <span>&</span> {game.opponent?.name ?? "the one you invited"}</h1></div><div className="room-chip"><LockKeyhole size={13} /> room {session.code}<button onClick={() => navigator.clipboard.writeText(session.code)} aria-label="Copy room code"><Copy size={14} /></button></div></header>
    <section className="chemistry-strip" aria-label={`Friendship core is ${chemistry} percent`}><div><span>friendship core</span><strong>{chemistry < 25 ? "warming up" : chemistry < 60 ? "in sync" : chemistry < 90 ? "inner circle" : "friendship legendary"}</strong></div><Progress value={chemistry} className="chemistry-progress" /><Heart size={18} fill="currentColor" /></section>
    {game.phase === "waiting" ? <section className="waiting-table"><div className="card-back waiting-back"><Heart /><span>SKY</span></div><p className="eyebrow">the table is waiting</p><h2>send this code to the person you would rather be here with</h2><button className="giant-code" onClick={() => navigator.clipboard.writeText(session.code)}>{session.code} <Copy size={20} /></button><p>The cards will deal themselves when they arrive.</p></section> : <>
      <section className="status-row"><div><span>{game.opponent?.name}</span><strong>{game.opponent?.cardCount ?? 0} cards · {game.opponent?.score ?? 0} points</strong></div><p>{game.lastMessage}</p><div className="align-right"><span>trick {game.trickNumber}</span><strong>{game.stockCount} in the stock</strong></div></section>
      {game.prompt && <section className="reveal-card"><div className="reveal-number">reveal {game.promptIndex}</div><Sparkles size={22} /><p>{game.prompt}</p><button onClick={() => setChatOpen(true)}>answer where only they can see <MessageCircle size={15} /></button></section>}
      <section className="table-area"><div className="opponent-hand" aria-label="Opponent cards">{Array.from({ length: Math.min(8, game.opponent?.cardCount ?? 0) }, (_, i) => <div className="mini-back" key={i}><Heart size={13} /></div>)}</div><div className="trick-stage">{game.currentTrick.length ? game.currentTrick.map(({ playerId, card }) => <div className="played-slot" key={`${playerId}-${card.id}`}><span>{playerId === game.you.id ? "you" : game.opponent?.name}</span><CardFace card={card} compact /></div>) : <div className="empty-trick"><Heart /><p>{isYourTurn ? "lead with a card" : `waiting for ${game.opponent?.name}`}</p></div>}</div></section>
      {game.phase === "finished" ? <section className="ending-card"><p className="eyebrow">the final trick</p><h2>{game.winnerId === game.you.id ? "you won the cards" : game.winnerId ? `${game.opponent?.name} won the cards` : "the cards call it even"}</h2><p>Winning was never the dangerous part. Being honest was.</p><Button onClick={() => setChatOpen(true)} className="primary-romance">keep talking</Button><span className="chat-kept">this room and every message will still be here when you return</span></section> : <section className="your-hand"><div className="hand-heading"><div><p className="eyebrow">your hand</p><h2>{isYourTurn ? "your move, beautiful" : "watch what they reveal"}</h2></div><span>{game.you.score} points captured</span></div>{error && <p className="error-note">{error}</p>}<div className="cards-scroll">{game.you.hand.map((card) => <CardFace key={card.id} card={card} onPlay={() => play(card.id)} disabled={!isYourTurn || busy} />)}</div></section>}
    </>}
    <Sheet open={chatOpen} onOpenChange={setChatOpen}><SheetTrigger asChild><button className="chat-orbit" aria-label="Open private chat"><MessageCircle /><span>between us</span>{unseen > 0 && <b>{Math.min(9, unseen)}</b>}</button></SheetTrigger><SheetContent className="chat-sheet"><SheetHeader className="chat-header"><SheetTitle>between us</SheetTitle><SheetDescription>Only the two people at this table can read this room. The chat stays here after the last trick.</SheetDescription></SheetHeader><div className="messages-list">{!game.messages.length && <div className="first-message"><Heart /><p>Someone has to risk saying the first honest thing.</p></div>}{game.messages.map((message) => <div key={message.id} className={`message-bubble ${message.player_id === game.you.id ? "mine" : "theirs"}`}><span>{message.player_id === game.you.id ? "you" : message.name}</span><p>{message.body}</p></div>)}<div ref={chatEnd} /></div><form onSubmit={sendMessage} className="chat-compose"><Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="say what the card made you think..." maxLength={500} aria-label="Private message" /><Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message"><Send /></Button></form></SheetContent></Sheet>
    {game.intermissionOpen && game.prompt && <section className="intermission-overlay" role="dialog" aria-modal="true" aria-labelledby="intermission-title"><div className="intermission-stars">✦　🪽　✧</div><p className="eyebrow">the cards are taking a breath</p><h2 id="intermission-title">intermission from heaven</h2><p className="intermission-question">{game.prompt}</p><div className="intermission-actions"><Button onClick={() => setChatOpen(true)} className="primary-romance"><MessageCircle /> answer between us</Button><Button onClick={readyFromHeaven} disabled={busy || game.youReady} variant="outline" className="ready-button">{game.youReady ? `waiting for ${game.opponent?.name}` : "we answered. return to the cards"}</Button><button onClick={readyFromHeaven} disabled={busy || game.youReady} className="skip-question">skip this question</button></div><p className="ready-count">{game.intermissionReadyCount} of 2 ready to return</p></section>}
  </main>;
}
