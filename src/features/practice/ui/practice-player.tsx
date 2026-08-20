"use client";

import { useRef, useState } from "react";
import type { PracticePlayer as PracticePlayerData } from "../domain/contracts";

/* Attempt-scoped authorised URLs cannot be passed through the Next image optimiser. */
/* eslint-disable @next/next/no-img-element */

type Props = { player: PracticePlayerData };
type ApiResult = { data?: { revision: number }; error?: { code?: string; message?: string } };
const mediaUrl = (player: PracticePlayerData, mediaId: string) => `/api/practice/media?attemptId=${player.attemptId}&setId=${player.setId}&mediaId=${mediaId}`;

export function PracticePlayer({ player: initialPlayer }: Props) {
  const [player, setPlayer] = useState(initialPlayer);
  const [position, setPosition] = useState(0);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());
  const item = player.items[position]!;
  const reload = async () => {
    try {
      const response = await fetch(`/api/practice/attempt/${player.attemptId}?setId=${player.setId}`, { cache: "no-store" });
      const result = await response.json() as { data?: PracticePlayerData; error?: { message?: string } };
      if (result.data) { const latest = result.data; setPlayer(latest); setPosition((current) => Math.min(current, latest.items.length - 1)); setNotice("The latest saved practice has been loaded."); }
      else setNotice(result.error?.message ?? "The latest practice could not be loaded. Please try again.");
    } catch { setNotice("The latest practice could not be loaded. Please check your connection and try again."); }
  };
  const request = async (path: "response" | "playback", body: Record<string, unknown>) => {
    if (saving) return undefined;
    setSaving(true);
    try {
      const response = await fetch(`/api/practice/attempt/${player.attemptId}/${path}`, { method: path === "response" ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setId: player.setId, itemId: item.id, expectedRevision: player.revision, ...body }) });
      let result: ApiResult;
      try { result = await response.json() as ApiResult; } catch { setNotice("The server gave an unexpected response. Please try again."); return undefined; }
      if (result.data) return result.data;
      if (result.error?.code === "ATTEMPT_REVISION_CONFLICT") { setNotice("This practice changed elsewhere. Loading the latest version..."); await reload(); return undefined; }
      setNotice(result.error?.message ?? "Your change could not be saved. Please try again.");
    } catch { setNotice("Your change could not be saved. Please check your connection and try again."); }
    finally { setSaving(false); }
    return undefined;
  };
  const save = async (value: string | boolean | number | null) => {
    const data = await request("response", { value });
    if (data) { setPlayer((current) => ({ ...current, revision: data.revision, items: current.items.map((entry) => entry.id === item.id ? { ...entry, response: value === null ? undefined : value } : entry) })); setNotice("Saved."); }
  };
  const replay = async (mediaId: string) => {
    const data = await request("playback", { mediaId });
    if (!data) return;
    const audio = audioRefs.current.get(mediaId);
    try { await audio?.play(); setPlayer((current) => ({ ...current, revision: data.revision })); setNotice("Playing audio."); } catch { setPlayer((current) => ({ ...current, revision: data.revision })); setNotice("Replay was saved, but the audio could not play. Please try again."); }
  };
  const pictures = item.media.filter((media) => media.type === "image");
  const audio = item.media.filter((media) => media.type === "audio");
  const choice = (value: string | boolean, label: string) => <button type="button" className={`choice ${item.response === value ? "selected" : ""}`} disabled={saving} onClick={() => void save(value)}>{label}</button>;
  return <main className="practice-player shell"><section className="player-card"><p className="eyebrow">Question {position + 1} of {player.items.length}</p><h1>{player.title}</h1><p>{item.prompt}</p>
    {item.engine !== "audio_picture_choice" && pictures.length > 0 && <div className="picture-stimuli">{pictures.map((media) => <img key={media.id} src={mediaUrl(player, media.id)} alt={media.altText} />)}</div>}
    {item.engine === "picture_true_false" && <div className="choice-row">{choice(true, "True")}{choice(false, "False")}</div>}
    {item.engine === "picture_yes_no" && <div className="choice-row">{choice("yes", "Yes")}{choice("no", "No")}</div>}
    {item.engine === "audio_picture_choice" && <div className="picture-choices">{pictures.map((media) => <button type="button" className={`picture-choice ${item.response === media.choiceLabel ? "selected" : ""}`} key={media.id} aria-label={media.choiceLabel} disabled={saving} onClick={() => void save(media.choiceLabel!)}><img src={mediaUrl(player, media.id)} alt={media.altText} /></button>)}</div>}
    {item.engine === "audio_note_taking" && <label className="answer-field">Type the word, name or number you hear<input value={typeof item.response === "string" || typeof item.response === "number" ? item.response : ""} disabled={saving} onChange={(event) => setPlayer((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, response: event.target.value } : entry) }))} onBlur={(event) => void save(event.target.value || null)} /></label>}
    {item.engine === "word_bank_cloze" && <><label className="answer-field">Choose a word from the word bank. You can change it before you submit.<input value={typeof item.response === "string" ? item.response : ""} readOnly /></label><div className="word-bank">{item.options.map((option) => choice(option, option))}</div></>}
    {audio.map((media) => <span key={media.id}><audio ref={(element) => { if (element) audioRefs.current.set(media.id, element); else audioRefs.current.delete(media.id); }} preload="metadata" src={mediaUrl(player, media.id)} /><button type="button" className="secondary replay" disabled={saving} onClick={() => void replay(media.id)}>Replay audio</button></span>)}
    <p role="status" aria-live="polite">{notice}</p><div className="player-actions"><button type="button" className="secondary" disabled={saving || position === 0} onClick={() => setPosition(position - 1)}>Previous</button><button type="button" disabled={saving || position === player.items.length - 1} onClick={() => setPosition(position + 1)}>Next</button><a className="practice-action secondary-link" href="/learner">Save and leave</a></div>
  </section></main>;
}
