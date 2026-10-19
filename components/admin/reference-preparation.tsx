"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { prepareStoredReference, type PreparationItem } from "@/lib/reference-client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
export function ReferencePreparation() {
  const [busy, setBusy] = useState(false), [status, setStatus] = useState(""), [failures, setFailures] = useState<string[]>([]);
  const cancelled = useRef(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  async function cleanup() {
    setBusy(true);
    try {
      const response = await fetch("/api/reference-preparation", { method: "DELETE" });
      if (!response.ok) throw new Error("Cleanup unavailable");
      const data = await response.json(); setStatus(`Removed ${data.removed} unused uploads; ${data.pending} remain pending. Attached reference photos were preserved.`); setCleanupOpen(false);
    } catch { setStatus("Unused upload cleanup is unavailable. Please retry."); }
    finally { setBusy(false); }
  }
  async function run() {
    setBusy(true); cancelled.current = false; setFailures([]); setStatus("Finding existing photos that need preparation...");
    try {
      const response = await fetch("/api/reference-preparation", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load references");
      const { items } = await response.json() as { items: PreparationItem[] };
      let done = 0;
      for (const [i, item] of items.entries()) {
        if (cancelled.current) break;
        setStatus(`Preparing ${i + 1}/${items.length}: ${item.label}. The first model download can take a few minutes.`);
        try { await prepareStoredReference(item); done++; }
        catch (error) { setFailures((old) => [...old, `${item.label}: ${error instanceof Error ? error.message : "Please retry"}`]); }
      }
      setStatus(`${cancelled.current ? "Stopped." : "Finished."} Prepared ${done} of ${items.length} pending photos. Run again to retry unfinished items.`);
    } catch { setStatus("Unable to prepare references. Please retry."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3 rounded-lg border bg-card p-4"><p className="font-semibold">Prepare existing image references</p><p className="text-sm text-muted-foreground">Process saved variety photos and reviewed scans for visual similarity ranking. No re-upload is needed. Existing one-image records remain usable, but five varied photos provide broader coverage.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={run}>{busy ? "Preparing..." : "Prepare / retry existing references"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setCleanupOpen(true)}>Clean unused uploads</Button>{busy && !cleanupOpen ? <Button type="button" variant="outline" onClick={() => { cancelled.current = true; setStatus("Stopping after the current image..."); }}>Stop after current image</Button> : null}</div><p role="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p>{failures.length ? <ul className="list-inside list-disc text-sm text-destructive">{failures.slice(0, 10).map((failure, i) => <li key={i}>{failure}</li>)}</ul> : null}<Dialog open={cleanupOpen} onOpenChange={(open) => { if (!busy) setCleanupOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Clean unused uploads?</DialogTitle><DialogDescription>Permanently remove unattached uploads older than 24 hours and retry pending removals. Photos still attached to varieties or shared by other records are protected.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setCleanupOpen(false)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={cleanup}>{busy ? "Cleaning..." : "Clean unused uploads"}</Button></div></DialogContent></Dialog></div>;
}
