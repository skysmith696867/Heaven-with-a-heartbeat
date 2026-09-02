"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { chronicleQuestions } from "@/lib/chronicle";

type Chronicle = { playerId: string; name: string; answers: Record<string, string> };
export type KintsugiState = { isAuthor: boolean; subjectPlayerId: string | null; subjectName: string; fragments: { questionId: number; word: string }[]; portrait: string; sealed: boolean };

export function KintsugiEnding({ kintsugi, chronicles, onSaveFragment, onSavePortrait, onKeepTalking, onReturn }: { kintsugi?: KintsugiState; chronicles: Chronicle[]; onSaveFragment: (questionId: number, word: string) => Promise<void>; onSavePortrait: (portrait: string, seal: boolean) => Promise<void>; onKeepTalking: () => void; onReturn: () => void }) {
  const subject = chronicles.find((profile) => profile.playerId === kintsugi?.subjectPlayerId);
  const answered = useMemo(() => chronicleQuestions.filter((question) => subject?.answers[String(question.id)]?.trim()), [subject]);
  const [words, setWords] = useState<Record<number, string>>(() => Object.fromEntries((kintsugi?.fragments ?? []).map((fragment) => [fragment.questionId, fragment.word])));
  const [portrait, setPortrait] = useState(kintsugi?.portrait ?? "");
  const [placed, setPlaced] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [stars, setStars] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const fragments = kintsugi?.fragments ?? [];
  const complete = fragments.length > 0 && placed.length === fragments.length;
  const allAnswered = answered.length === chronicleQuestions.length;

  async function saveWord(questionId: number) {
    const word = words[questionId]?.trim() ?? "";
    if (!word || /\s/.test(word)) { setNotice("One piece. One word."); return; }
    await onSaveFragment(questionId, word); setNotice(`“${word}” became part of the heart.`);
  }
  function place(questionId: number) { if (!placed.includes(questionId)) setPlaced((current) => [...current, questionId]); setSelected(null); }
  function catchStar(index: number) { if (!stars.includes(index)) setStars((current) => [...current, index]); }

  return <section className="kintsugi-realm">
    <div className="kintsugi-title"><p className="eyebrow">after the final trick</p><h2>Fix the Heart: Kintsugi</h2><p>Kintsugi is what happens when you refuse to pretend something was never broken. You trace every fracture in gold until the damage becomes part of the design—and the object returns more honest, more valuable, and impossible to recreate.</p></div>
    {kintsugi?.isAuthor ? <div className="sky-writing-desk">
      <div><p className="eyebrow">Sky’s private writing desk</p><h3>Name the pieces of {kintsugi.subjectName}</h3><p>Read each answer, then distill it into exactly one word. Nothing becomes canon until you choose it.</p></div>
      <div className="fragment-editor">{answered.map((question) => <article key={question.id}><small>{String(question.id).padStart(2, "0")} · {question.prompt}</small><p>{subject?.answers[String(question.id)]}</p><div><Input value={words[question.id] ?? ""} onChange={(event) => setWords((current) => ({ ...current, [question.id]: event.target.value.replace(/\s/g, "") }))} maxLength={28} placeholder="one word" aria-label={`One-word summary for question ${question.id}`} /><Button onClick={() => void saveWord(question.id)}>name piece</Button></div></article>)}</div>
      <label className="myth-editor"><span>the mythological portrait — written by Sky</span><Textarea value={portrait} onChange={(event) => setPortrait(event.target.value)} maxLength={12000} placeholder="Write the person the fragments revealed…" /></label>
      {notice && <p className="kintsugi-notice">{notice}</p>}
      <div className="seal-actions"><Button variant="outline" onClick={() => void onSavePortrait(portrait, false)} disabled={!portrait.trim()}>save draft</Button><Button onClick={() => void onSavePortrait(portrait, true)} disabled={!portrait.trim() || !allAnswered}>Seal Their Myth <Sparkles /></Button></div>
      {!allAnswered && <p className="seal-rule">The seal awakens after all {chronicleQuestions.length} Chronicle questions are answered · {answered.length} complete.</p>}
    </div> : <>
      <div className={`heart-workshop ${complete ? "is-mended" : ""}`}>
        <div className="heart-board" aria-label="Heart puzzle board">{fragments.map((fragment, index) => <button key={fragment.questionId} className={`heart-slot ${placed.includes(fragment.questionId) ? "is-filled" : ""}`} style={{ "--piece-index": index } as CSSProperties} onClick={() => selected === fragment.questionId && place(fragment.questionId)}>{placed.includes(fragment.questionId) ? fragment.word : ""}</button>)}</div>
        <div className="piece-tray"><p>{fragments.length ? "Drag a fragment—or tap it, then its place." : "Sky is still naming the pieces of your heart."}</p>{fragments.filter((fragment) => !placed.includes(fragment.questionId)).map((fragment) => <button key={fragment.questionId} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", String(fragment.questionId))} onClick={() => setSelected(fragment.questionId)} className={selected === fragment.questionId ? "is-selected" : ""}>{fragment.word}</button>)}</div>
        <div className="heart-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => place(Number(event.dataTransfer.getData("text/plain")))}>{selected ? <button onClick={() => place(selected)}>place “{fragments.find((fragment) => fragment.questionId === selected)?.word}” in the heart</button> : "gold remembers where every piece belongs"}</div>
      </div>
      <div className={`legend-box ${complete ? "is-open" : ""}`}><Heart fill="currentColor" />{kintsugi?.sealed && allAnswered && complete ? <><p className="eyebrow">the box opens</p><h3>The Chronicle of {kintsugi.subjectName}</h3><p className="sealed-myth">{kintsugi.portrait}</p><strong>You were never putting them back the way they were. You were learning where the gold belonged.</strong></> : <><p className="eyebrow">sealed for now</p><h3>Sky is writing your legend.</h3><p>Some people can be understood quickly. You were not one of them.</p></>}</div>
      <div className="constellation-weaver"><p className="eyebrow">while the legend is written</p><h3>Constellation Weaver</h3><p>Catch the wandering stars. Your stardust decorates the waiting box.</p><div>{Array.from({ length: 12 }, (_, index) => <button key={index} className={stars.includes(index) ? "is-caught" : ""} onClick={() => catchStar(index)} aria-label={`Catch star ${index + 1}`}>✦</button>)}</div><strong>{stars.length} stardust</strong></div>
    </>}
    <div className="ending-actions"><Button onClick={onKeepTalking}>keep talking</Button><Button onClick={onReturn} variant="outline">back to the beginning of time</Button></div>
  </section>;
}
