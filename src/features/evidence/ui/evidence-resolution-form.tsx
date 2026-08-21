"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EvidenceResolutionForm({ reviewItemId, revision }: { reviewItemId: string; revision: number }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function resolve(formData: FormData) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/evidence", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ reviewItemId, revision, outcome: formData.get("outcome"), reason: formData.get("reason") }) });
      let body: { error?: { code?: string; message?: string } };
      try { body = await response.json() as { error?: { code?: string; message?: string } }; } catch { setMessage("Resolution could not be saved."); return; }
      if (!response.ok) {
        setMessage(body.error?.message ?? "Resolution could not be saved.");
        if (body.error?.code === "TEACHER_RESOLUTION_CONFLICT") router.refresh();
        return;
      }
      setMessage("Resolution saved.");
      router.refresh();
    } catch {
      setMessage("Resolution could not be saved.");
    } finally {
      setPending(false);
    }
  }
  return <form className="evidence-resolution" action={resolve} aria-label="Resolve uncertain outcome">
    <label>Effective outcome<select name="outcome" defaultValue="correct"><option value="correct">Correct</option><option value="incorrect">Incorrect</option><option value="unanswered">Unanswered</option></select></label>
    <label>Reason<textarea name="reason" required maxLength={500} /></label>
    <button type="submit" disabled={pending}>{pending ? "Saving..." : "Save resolution"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
