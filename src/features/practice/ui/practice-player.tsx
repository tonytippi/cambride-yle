"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { createOpenAttemptDraft, openAttemptDraftStore, sameIdentityDraft, shouldApplyDraftHydration, type DraftResponse, unsyncedResponses, usableDraft } from "@/features/pwa/open-attempt-drafts";
import { namespacedDraftKey } from "@/features/pwa/cache-policy";
import type { PracticePlayer as PracticePlayerData, PracticeRecoveryState } from "../domain/contracts";

/* Attempt-scoped authorised URLs cannot be passed through the Next image optimiser. */
/* eslint-disable @next/next/no-img-element */

type Props = { player: PracticePlayerData; accountId: string };
type ApiResult = { data?: { revision: number }; error?: { code?: string; message?: string } };

function responses(player: PracticePlayerData): Record<string, DraftResponse> {
  return Object.fromEntries(player.items.filter((item) => item.response !== undefined).map((item) => [item.id, item.response ?? null]));
}

export function PracticePlayer({ player: initialPlayer, accountId }: Props) {
  const router = useRouter();
  const [player, setPlayer] = useState(initialPlayer);
  const [position, setPosition] = useState(0);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const online = () => typeof navigator !== "undefined" && navigator.onLine;
  /* Starts as online to match the server render; the mount effect reads the real connection state. */
  const [recovery, setRecovery] = useState<PracticeRecoveryState>("online");
  const [stale, setStale] = useState(false);
  const [staleResponses, setStaleResponses] = useState<Record<string, DraftResponse>>({});
  const [unsynced, setUnsynced] = useState(0);
  const [played, setPlayed] = useState<ReadonlySet<string>>(new Set());
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);
  const pending = useRef(new Map<string, DraftResponse>());
  const staleRef = useRef(false);
  const flushRef = useRef<() => Promise<boolean>>(async () => false);
  const hydrated = useRef(false);
  const audioRefs = useRef(new Map<string, HTMLAudioElement>());
  const editEpoch = useRef(0);
  const draftQueue = useRef(Promise.resolve());
  const mutationQueue = useRef(Promise.resolve());
  const playerRef = useRef(player);
  const submitKey = useRef<string | undefined>(undefined);
  const draftKey = namespacedDraftKey(accountId, player.attemptId, player.setVersionId);
  const item = player.items[position]!;
  const mediaUrl = (media: PracticePlayerData["items"][number]["media"][number]) => `/api/practice/media?attemptId=${player.attemptId}&setId=${player.setId}&setVersionId=${player.setVersionId}&mediaId=${media.id}&mediaKey=${encodeURIComponent(media.mediaKey)}&accountId=${encodeURIComponent(accountId)}`;

  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { staleRef.current = stale; }, [stale]);
  // Move focus to the new question (not on first load) and to the confirmation, so the change is announced.
  useEffect(() => { if (navigated.current) questionHeading.current?.focus(); }, [position]);
  useEffect(() => { if (confirmingSubmit) confirmationHeading.current?.focus(); }, [confirmingSubmit]);
  const goTo = (next: number) => { navigated.current = true; setPosition(next); };
  const markPlayed = (mediaId: string) => setPlayed((current) => new Set(current).add(mediaId));
  const enqueue = <T,>(task: () => Promise<T>) => { const next = mutationQueue.current.then(task); mutationQueue.current = next.then(() => undefined, () => undefined); return next; };
  const markPending = (itemId: string, value: DraftResponse) => { pending.current.set(itemId, value); setUnsynced(pending.current.size); };
  const writeDraft = async (next: PracticePlayerData = playerRef.current, state: PracticeRecoveryState = online() ? "saved" : "offline") => {
    const write = draftQueue.current.then(() => openAttemptDraftStore.write(createOpenAttemptDraft(accountId, next.attemptId, next.setVersionId, next.revision, responses(next))));
    draftQueue.current = write.catch(() => undefined);
    try { await write; setRecovery(state); }
    catch { setRecovery("unsaved"); setNotice("This device cannot keep a copy of your answers. Please keep this page open."); }
  };

  useEffect(() => {
    const offline = () => setRecovery("offline");
    const connection = setTimeout(() => { if (!navigator.onLine) setRecovery("offline"); }, 0);
    const online = () => { setRecovery("online"); void flushRef.current(); };
    window.addEventListener("offline", offline); window.addEventListener("online", online);
    const controller = navigator.serviceWorker?.controller;
    controller?.postMessage({ type: "cambridgeyle-active-account", accountId });
    const hydrationEpoch = editEpoch.current;
    // Hydrate once: a re-run would read the draft this player has since advanced and report a false conflict.
    if (!hydrated.current) { hydrated.current = true; void openAttemptDraftStore.read(draftKey).then(async (draft) => {
      if (!draft) return;
      if (!sameIdentityDraft(draft, accountId, initialPlayer.attemptId, initialPlayer.setVersionId)) { await openAttemptDraftStore.delete(draftKey).catch(() => undefined); return; }
      if (!usableDraft(draft, accountId, initialPlayer.attemptId, initialPlayer.setVersionId, initialPlayer.revision)) { setStaleResponses(draft.responses); setStale(true); setRecovery("stale"); setNotice("This practice changed on another device. Choose Load latest or Leave."); return; }
      if (!shouldApplyDraftHydration(hydrationEpoch, editEpoch.current)) return;
      const recovered = { ...playerRef.current, items: playerRef.current.items.map((entry) => draft.responses[entry.id] === undefined ? entry : { ...entry, response: draft.responses[entry.id] ?? undefined }) };
      playerRef.current = recovered; setPlayer(recovered);
      for (const [itemId, value] of unsyncedResponses(Object.fromEntries(initialPlayer.items.map((entry) => [entry.id, entry.response])), draft.responses)) markPending(itemId, value);
      setRecovery("saved"); setNotice("Welcome back. Your answers are here.");
      if (pending.current.size) void flushRef.current();
    }).catch(() => { setRecovery("unsaved"); setNotice("This device cannot keep a copy of your answers. Please keep this page open."); }); }
    return () => { clearTimeout(connection); controller?.postMessage({ type: "cambridgeyle-clear-account" }); window.removeEventListener("offline", offline); window.removeEventListener("online", online); };
  }, [accountId, draftKey, initialPlayer]);

  const reload = async () => {
    try {
      const response = await fetch(`/api/practice/attempt/${player.attemptId}?setId=${player.setId}`, { cache: "no-store" });
      let result: { data?: PracticePlayerData; error?: { message?: string } };
      try { result = await response.json() as { data?: PracticePlayerData; error?: { message?: string } }; } catch { setNotice("Something went wrong. Please try again."); return; }
      if (!result.data) { setNotice(result.error?.message ?? "We could not load your practice. Please try again."); return; }
      await openAttemptDraftStore.delete(draftKey);
      pending.current.clear(); setUnsynced(0); staleRef.current = false;
      const latest = result.data;
      setPlayer(latest); setPosition((current) => Math.min(current, latest.items.length - 1)); setStaleResponses({}); setStale(false); setRecovery(online() ? "online" : "offline"); setNotice("Here is your latest practice.");
    } catch { setNotice("We could not load your practice. Check the internet and try again."); }
  };

  const markStale = () => { staleRef.current = true; setStale(true); setRecovery("stale"); setNotice("This practice changed on another device. Choose Load latest or Leave."); };
  /* A revision conflict is harmless when the server already holds every pending answer, e.g. a save that landed just before a reload. */
  const reconcile = async () => {
    try {
      const current = playerRef.current;
      const response = await fetch(`/api/practice/attempt/${current.attemptId}?setId=${current.setId}`, { cache: "no-store" });
      const latest = (await response.json() as { data?: PracticePlayerData }).data;
      if (!latest || [...pending.current].some(([itemId, value]) => (latest.items.find((entry) => entry.id === itemId)?.response ?? null) !== value)) return false;
      pending.current.clear(); setUnsynced(0);
      const merged = { ...current, revision: latest.revision }; playerRef.current = merged; setPlayer(merged);
      await writeDraft(merged);
      return true;
    } catch { return false; }
  };
  const request = async (path: "response" | "playback", body: Record<string, unknown>, currentItemId: string, onConflict: () => Promise<boolean> = async () => false) => {
    if (staleRef.current || !online()) { if (!online()) { setRecovery("offline"); setNotice("No internet right now. Your answer is kept on this device."); } return undefined; }
    try {
      const current = playerRef.current;
      const response = await fetch(`/api/practice/attempt/${current.attemptId}/${path}`, { method: path === "response" ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setId: current.setId, itemId: currentItemId, expectedRevision: current.revision, ...body }) });
      let result: ApiResult;
      try { result = await response.json() as ApiResult; } catch { setNotice("Something went wrong. Please try again."); return undefined; }
      if (result.data) return result.data;
      if (result.error?.code === "ATTEMPT_REVISION_CONFLICT" && await onConflict()) return undefined;
      if (result.error?.code === "ATTEMPT_REVISION_CONFLICT" || result.error?.code === "ATTEMPT_SCOPE_MISMATCH" || result.error?.code === "ATTEMPT_FINALISED") { markStale(); return undefined; }
      setNotice(result.error?.message ?? "Your answer did not save. Please try again.");
    } catch { setRecovery("offline"); setNotice("No internet right now. Your answer is kept on this device."); }
    return undefined;
  };

  /* Sends every answer the server has not confirmed, in order; anything left stays pending and blocks submission. */
  const flush = () => enqueue(async () => {
    for (const [itemId, value] of [...pending.current]) {
      if (staleRef.current || !online()) break;
      const data = await request("response", { value }, itemId, reconcile);
      if (!data) break;
      const saved = { ...playerRef.current, revision: data.revision }; playerRef.current = saved; setPlayer(saved);
      if (Object.is(pending.current.get(itemId), value)) pending.current.delete(itemId);
      await writeDraft(saved);
    }
    setUnsynced(pending.current.size);
    if (!pending.current.size && !staleRef.current) setNotice("Saved.");
    return pending.current.size === 0;
  });
  useEffect(() => { flushRef.current = flush; });
  const setLocal = (itemId: string, value: DraftResponse) => {
    editEpoch.current += 1;
    const current = playerRef.current;
    const next = { ...current, items: current.items.map((entry) => entry.id === itemId ? { ...entry, response: value === null ? undefined : value } : entry) };
    playerRef.current = next;
    setPlayer(next);
    markPending(itemId, value);
    void writeDraft(next);
  };
  const save = async (value: DraftResponse) => { setLocal(item.id, value); await flush(); };
  const replay = async (mediaId: string) => {
    const audio = audioRefs.current.get(mediaId);
    if (!audio) { setNotice("The sound is not ready yet. Please try again."); return; }
    if (!online()) { try { await audio.play(); setRecovery("offline"); setNotice("Playing the sound."); markPlayed(mediaId); } catch { setNotice("The sound could not play. Please try again."); } return; }
    const itemId = item.id;
    const mutation = mutationQueue.current.then(async () => {
      try { await audio.play(); markPlayed(mediaId); } catch { setNotice("The sound could not play. Please try again."); return; }
      const data = await request("playback", { mediaId }, itemId);
      if (data) { const saved = { ...playerRef.current, revision: data.revision }; playerRef.current = saved; setPlayer(saved); await writeDraft(saved); setNotice("Playing the sound."); }
    });
    mutationQueue.current = mutation.catch(() => undefined);
    await mutation;
  };
  const leave = async (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); if (stale) await openAttemptDraftStore.delete(draftKey); else await writeDraft(playerRef.current); await draftQueue.current; router.push("/learner"); };
  const submit = async () => {
    if (!online()) { setRecovery("offline"); setNotice("No internet right now. Connect again, then submit your practice."); return; }
    if (!await flush()) { setConfirmingSubmit(false); if (!staleRef.current) setNotice("Some answers are not saved yet. Check the internet and try again."); return; }
    setSubmitting(true);
    try {
      const current = playerRef.current;
      submitKey.current ??= crypto.randomUUID();
      const result = await fetch(`/api/practice/attempt/${current.attemptId}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ setId: current.setId, expectedRevision: current.revision, idempotencyKey: submitKey.current }) }).then((response) => response.json() as Promise<ApiResult>);
      if (result.data) { await openAttemptDraftStore.delete(draftKey); router.push(`/learner/practice/${current.setId}/attempt/${current.attemptId}/review`); return; }
      if (result.error?.code === "ATTEMPT_REVISION_CONFLICT" || result.error?.code === "ATTEMPT_SCOPE_MISMATCH" || result.error?.code === "ATTEMPT_FINALISED") { staleRef.current = true; setStale(true); setRecovery("stale"); setConfirmingSubmit(false); setNotice("This practice changed on another device. Choose Load latest or Leave."); return; }
      setNotice(result.error?.message ?? "We could not submit your practice. Please try again.");
    } catch { setNotice("We could not submit your practice. Check the internet and try again."); }
    finally { setSubmitting(false); }
  };
  const openConfirmation = async () => {
    if (!online()) { await submit(); return; }
    if (!await flush()) { if (!staleRef.current) setNotice("Some answers are not saved yet. Check the internet and try again."); return; }
    setConfirmingSubmit(true);
  };
  const visibleResponse = stale && staleResponses[item.id] !== undefined ? staleResponses[item.id] : item.response;
  const pictures = item.media.filter((media) => media.type === "image");
  const audio = item.media.filter((media) => media.type === "audio");
  const promptId = `prompt-${item.id}`;
  const hintId = `hint-${item.id}`;
  const choice = (value: string | boolean, label: string) => <button key={String(value)} type="button" aria-pressed={visibleResponse === value} className={`choice ${visibleResponse === value ? "selected" : ""}`} disabled={submitting || stale} onClick={() => void save(value)}>{visibleResponse === value && <span className="choice-mark" aria-hidden="true">✓ </span>}{label}</button>;
  const recoveryMessage: Record<PracticeRecoveryState, string> = { online: "Your answers save as you go.", saved: "Your answers save as you go.", offline: "No internet right now. Your answers stay on this device.", unsaved: "This device cannot keep a copy of your answers. Please keep this page open.", stale: "This practice changed on another device." };
  const answeredCount = player.items.filter((entry) => entry.response !== undefined).length;
  const unansweredCount = player.items.length - answeredCount;
  const reviewQuestions = () => { setConfirmingSubmit(false); const first = player.items.findIndex((entry) => entry.response === undefined); goTo(first === -1 ? 0 : first); };
  return <main className="practice-player shell"><section className="player-card">
    <h1>{player.title}</h1>
    <h2 className="question-progress" ref={questionHeading} tabIndex={-1}>Question {position + 1} of {player.items.length}</h2>
    <p className={`recovery-state ${recovery}`} role="status" aria-live="polite">{recoveryMessage[recovery]}{unsynced > 0 && (recovery === "offline" || recovery === "unsaved" ? ` ${unsynced === 1 ? "1 answer is" : `${unsynced} answers are`} not saved yet.` : " Saving…")} {recovery === "unsaved" && <button type="button" className="secondary inline-action" onClick={() => void writeDraft(playerRef.current)}>Try again</button>}</p>
    {stale && <div className="recovery-actions"><button type="button" className="secondary" onClick={() => void reload()}>Load latest</button><a className="practice-action secondary-link" href="/learner" onClick={(event) => void leave(event)}>Leave</a></div>}
    <p className="question-prompt" id={promptId}>{item.prompt}</p>
    {item.engine !== "audio_picture_choice" && pictures.length > 0 && <div className="picture-stimuli">{pictures.map((media) => <img key={media.id} src={mediaUrl(media)} alt={media.altText} />)}</div>}
    {audio.length > 0 && <div className="audio-controls">{audio.map((media, index) => <span key={media.id}><audio ref={(element) => { if (element) audioRefs.current.set(media.id, element); else audioRefs.current.delete(media.id); }} preload="metadata" src={mediaUrl(media)} /><button type="button" className="secondary replay" disabled={submitting || stale} onClick={() => void replay(media.id)}>{played.has(media.id) ? "Play again" : "Play the sound"}{audio.length > 1 ? ` ${index + 1}` : ""}</button></span>)}</div>}
    {item.engine === "picture_true_false" && <div className="choice-row" role="group" aria-labelledby={promptId}>{choice(true, "True")}{choice(false, "False")}</div>}
    {item.engine === "picture_yes_no" && <div className="choice-row" role="group" aria-labelledby={promptId}>{choice("yes", "Yes")}{choice("no", "No")}</div>}
    {item.engine === "audio_picture_choice" && <div className="picture-choices" role="group" aria-labelledby={promptId}>{pictures.map((media) => <button type="button" aria-pressed={visibleResponse === media.choiceLabel} className={`picture-choice ${visibleResponse === media.choiceLabel ? "selected" : ""}`} key={media.id} aria-label={media.choiceLabel} disabled={submitting || stale} onClick={() => void save(media.choiceLabel!)}><img src={mediaUrl(media)} alt={media.altText} />{visibleResponse === media.choiceLabel && <span className="choice-mark" aria-hidden="true">✓</span>}</button>)}</div>}
    {item.engine === "audio_note_taking" && <><label className="answer-field">Your answer<input aria-describedby={hintId} value={typeof visibleResponse === "string" || typeof visibleResponse === "number" ? visibleResponse : ""} disabled={stale} onChange={(event) => setLocal(item.id, event.target.value || null)} onBlur={() => void flush()} /></label><p className="answer-hint" id={hintId}>{item.answerHint ?? "Write what you hear."}</p></>}
    {item.engine === "word_bank_cloze" && <><label className="answer-field">Your answer<input aria-describedby={hintId} value={typeof visibleResponse === "string" ? visibleResponse : ""} readOnly /></label><p className="answer-hint" id={hintId}>Tap a word from the box. You can change it before you finish.</p><div className="word-bank" role="group" aria-label="Word box">{item.options.map((option) => choice(option, option))}</div></>}
    <p role="status" aria-live="polite">{notice}</p>
    {confirmingSubmit && <section className="submit-confirmation" aria-labelledby="submit-heading"><h2 id="submit-heading" ref={confirmationHeading} tabIndex={-1}>Ready to submit?</h2><p>{unansweredCount ? `You answered ${answeredCount} of ${player.items.length} questions. ${unansweredCount === 1 ? "1 question has" : `${unansweredCount} questions have`} no answer yet.` : `You answered all ${player.items.length} questions.`} When you submit, you can check your answers.</p><button type="button" className="secondary" onClick={reviewQuestions}>Review questions</button><button type="button" disabled={submitting || stale} onClick={() => void submit()}>{unansweredCount ? "Submit anyway" : "Submit now"}</button></section>}
    {!confirmingSubmit && <div className="player-actions"><button type="button" className="secondary" disabled={stale || position === 0} onClick={() => goTo(position - 1)}>Previous</button><button type="button" disabled={stale || position === player.items.length - 1} onClick={() => goTo(position + 1)}>Next</button>{!stale && <><a className="practice-action secondary-link" href="/learner" onClick={(event) => void leave(event)}>Save and leave</a><button type="button" disabled={submitting} onClick={() => void openConfirmation()}>Submit practice</button></>}</div>}
  </section></main>;
}
