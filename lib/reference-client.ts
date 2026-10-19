"use client";
import { extractImageEmbedding, optimizeImageFile } from "@/lib/image-analysis";
import { imageValidationError } from "@/lib/screening";
export type PreparationItem = { kind: "variety" | "review"; varietyId?: string; imageId?: string; exampleId?: string; url: string; label?: string };
export async function prepareStoredReference(item: PreparationItem) {
  const response = await fetch(item.url, { credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("Unable to read saved image. Retry or replace it in Edit Variety.");
  const blob = await response.blob();
  const file = new File([blob], "saved-reference", { type: blob.type.split(";")[0] });
  const error = imageValidationError(file);
  if (error) throw new Error(error);
  const optimized = await optimizeImageFile(file);
  const embedding = await extractImageEmbedding(optimized);
  // The browser already read the saved photo. Send those pixels to our server
  // rather than requiring a second storage download with different access rules.
  const body = new FormData();
  body.set("metadata", JSON.stringify({ ...item, imageId: item.imageId || undefined, embedding }));
  body.set("image", optimized);
  const prepared = await fetch("/api/reference-preparation", { method: "POST", body });
  const data = await prepared.json().catch(() => ({}));
  if (!prepared.ok) throw new Error(data.message || "Unable to prepare reference");
  return data as { id: string; url: string; position: number; ready: boolean };
}
