"use client";
import { extractImageEmbedding } from "@/lib/image-analysis";
import { imageValidationError } from "@/lib/screening";
export type PreparationItem = { kind: "variety" | "review"; varietyId?: string; imageId?: string; exampleId?: string; url: string; label?: string };
export async function prepareStoredReference(item: PreparationItem) {
  const response = await fetch(item.url, { credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("Unable to read saved image. Retry or replace it in Edit Variety.");
  const blob = await response.blob();
  const file = new File([blob], "saved-reference", { type: blob.type.split(";")[0] });
  const error = imageValidationError(file);
  if (error) throw new Error(error);
  const embedding = await extractImageEmbedding(file);
  const prepared = await fetch("/api/reference-preparation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, imageId: item.imageId || undefined, embedding }) });
  const data = await prepared.json().catch(() => ({}));
  if (!prepared.ok) throw new Error(data.message || "Unable to prepare reference");
  return data as { id: string; url: string; position: number; ready: boolean };
}
