"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PracticePreparation, PracticeResult, PracticeStart } from "../domain/contracts";

type AssetState = "Preparing" | "Ready" | "Unavailable";

function preload(asset: PracticePreparation["assets"][number]) {
  return new Promise<void>((resolve, reject) => {
    const element = asset.type === "audio" ? new Audio() : new Image();
    element.onload = () => resolve();
    element.onerror = () => reject(new Error("MEDIA_UNAVAILABLE"));
    if (asset.type === "audio") element.addEventListener("canplaythrough", () => resolve(), { once: true });
    element.src = asset.url;
  });
}

export function Preparation({ initial }: { initial: PracticeResult<PracticePreparation> }) {
  const [preparation, setPreparation] = useState(initial);
  const [states, setStates] = useState<Record<string, AssetState>>(() => "data" in initial ? Object.fromEntries(initial.data.assets.map((asset) => [asset.id, "Preparing"])) : {});
  const [starting, setStarting] = useState(false);
  const router = useRouter();
  const data = "data" in preparation ? preparation.data : undefined;
  async function checkAssets(current = data) {
    if (!current) return;
    setStates(Object.fromEntries(current.assets.map((asset) => [asset.id, "Preparing"])));
    await Promise.all(current.assets.map(async (asset) => {
      try { await preload(asset); setStates((previous) => ({ ...previous, [asset.id]: "Ready" })); }
      catch { setStates((previous) => ({ ...previous, [asset.id]: "Unavailable" })); }
    }));
  }
  async function retry() {
    window.location.reload();
  }
  async function start() {
    if (!data) return;
    setStarting(true);
    try {
      const response = await fetch("/api/practice/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ setId: data.setId }), cache: "no-store" });
      const result = await response.json() as PracticeResult<PracticeStart>;
      if ("error" in result) { setPreparation({ error: result.error }); return; }
      router.push(`/learner/practice/${data.setId}/attempt/${result.data.attemptId}`);
    } catch {
      setPreparation({ error: { code: "MEDIA_UNAVAILABLE", message: "We could not start this practice activity. Please retry." } });
    } finally {
      setStarting(false);
    }
  }
  const ready = !!data && data.assets.every((asset) => states[asset.id] === "Ready");
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => {
      void Promise.all(data.assets.map(async (asset) => {
        try { await preload(asset); setStates((previous) => ({ ...previous, [asset.id]: "Ready" })); }
        catch { setStates((previous) => ({ ...previous, [asset.id]: "Unavailable" })); }
      }));
    }, 0);
    return () => clearTimeout(timer);
  }, [data]); // Browser readiness is UX-only; start is revalidated on the server.
  return <main className="shell"><section className="preparation"><p className="eyebrow">Practice preparation</p><h1>{data?.title ?? "Practice activity"}</h1>{"error" in preparation ? <><p className="error" role="alert">{preparation.error.message}</p><div className="preparation-actions"><button onClick={retry}>Retry</button><a className="practice-action secondary-link" href="/learner">Leave</a></div></> : <><p id="preparation-status" role="status">Check that essential media is ready before you start.</p><ul className="media-readiness" aria-describedby="preparation-status">{data!.assets.map((asset) => <li key={asset.id}><strong>{asset.type === "audio" ? "Audio" : "Image"}</strong><span aria-live="polite">{states[asset.id] ?? "Preparing"}</span></li>)}</ul><div className="preparation-actions"><button disabled={!ready || starting} onClick={start}>{starting ? "Starting..." : "Start"}</button><button className="secondary" onClick={() => checkAssets()}>Check again</button><a className="practice-action secondary-link" href="/learner">Leave</a></div></>}</section></main>;
}
