"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type VarietyOption = {
  id: string;
  name: string;
};

type Props = {
  historyId: string;
  currentVarietyId?: string | null;
  varieties: VarietyOption[];
};

export function IdentificationReviewForm({ historyId, currentVarietyId, varieties }: Props) {
  const router = useRouter();
  const [selectedVarietyId, setSelectedVarietyId] = useState(currentVarietyId || "");
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function deleteScan() {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/identifications/${historyId}`, { method: "DELETE" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to delete scan. Please retry.");
        setConfirmDelete(false);
        toast.success("Scan deleted. Reviewed learning examples were preserved.");
        router.refresh();
      } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to delete scan. Please retry."); }
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVarietyId) {
      toast.error("Select a coconut variety first");
      return;
    }

    startTransition(async () => {
      try {
      const response = await fetch(`/api/identifications/${historyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coconutVarietyId: selectedVarietyId })
      });

      const data = await response.json().catch(() => ({ message: "Unable to update identification" }));
      if (!response.ok) {
        toast.error(data.message || "Unable to update identification");
        return;
      }

      if (data.referenceReady) toast.success("Correction saved. This image can now be used as a reviewed reference.");
      else toast.warning("Correction saved, but the reference image could not be read. Future scans may remain uncertain.");
      router.refresh();
      } catch { toast.error("Unable to update identification. Please retry."); }
    });
  }

  function markNotCoconut() {
    startTransition(async () => {
      try {
      const response = await fetch(`/api/identifications/${historyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isNotCoconut: true })
      });

      const data = await response.json().catch(() => ({ message: "Unable to mark image" }));
      if (!response.ok) {
        toast.error(data.message || "Unable to mark image");
        return;
      }

      setSelectedVarietyId("");
      toast.success("Marked as not coconut");
      router.refresh();
      } catch { toast.error("Unable to mark image. Please retry."); }
    });
  }

  return (
    <div className="space-y-3">
    <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={onSubmit}>
      <select
        className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        value={selectedVarietyId}
        disabled={pending}
        onChange={(event) => setSelectedVarietyId(event.target.value)}
      >
        <option value="">Select correct variety</option>
        {varieties.map((variety) => (
          <option key={variety.id} value={variety.id}>
            {variety.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        <CheckCircle2 className="h-4 w-4" /> {pending ? "Saving..." : "Correct"}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={markNotCoconut}>
        <Ban className="h-4 w-4" /> Not Coconut
      </Button>
    </form>
    <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => setConfirmDelete(true)}>
      <Trash2 className="h-4 w-4" /> Delete scan
    </Button>
    <Dialog open={confirmDelete} onOpenChange={(open) => { if (!pending) setConfirmDelete(open); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this scan?</DialogTitle>
          <DialogDescription>This permanently removes the scan history and uploaded image. Images shared by other records are kept. Reviewed learning examples remain available. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={deleteScan}>{pending ? "Deleting..." : "Delete scan"}</Button>
        </div>
      </DialogContent>
    </Dialog>
    </div>
  );
}
