"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

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

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVarietyId) {
      toast.error("Select a coconut variety first");
      return;
    }

    startTransition(async () => {
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

      toast.success("Identification corrected");
      router.refresh();
    });
  }

  function markNotCoconut() {
    startTransition(async () => {
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
    });
  }

  return (
    <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]" onSubmit={onSubmit}>
      <select
        className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        value={selectedVarietyId}
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
  );
}
