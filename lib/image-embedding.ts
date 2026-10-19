import { z } from "zod";

export const EMBEDDING_MODEL = "Xenova/clip-vit-base-patch32";
export const embeddingSchema = z.object({
  model: z.literal(EMBEDDING_MODEL), version: z.literal(1), dtype: z.literal("q8"),
  values: z.array(z.number().finite().min(-1).max(1)).length(512)
}).refine((value) => Math.abs(Math.hypot(...value.values) - 1) < 0.02, "Expected a normalized image embedding");
export type ImageEmbedding = z.infer<typeof embeddingSchema>;
export function normalizeEmbedding(values: ArrayLike<number>): ImageEmbedding {
  const array = Array.from(values), norm = Math.hypot(...array);
  if (!norm || !Number.isFinite(norm)) throw new Error("Invalid image embedding");
  return embeddingSchema.parse({ model: EMBEDDING_MODEL, version: 1, dtype: "q8", values: array.map((v) => v / norm) });
}
export function readEmbedding(value: unknown) { const result = embeddingSchema.safeParse(value); return result.success ? result.data : null; }
export function cosineSimilarity(first: ImageEmbedding, second: ImageEmbedding) {
  return Math.max(0, Math.min(1, first.values.reduce((sum, value, i) => sum + value * second.values[i], 0) / (Math.hypot(...first.values) * Math.hypot(...second.values))));
}

export type GalleryImage = { id: string; url: string; position: number; ready?: boolean };
export const GALLERY_SIZE = 5;
export function validateGallery(images: { id: string; digest: string | null }[]) {
  if (images.length !== GALLERY_SIZE) throw new Error("Exactly five reference images are required.");
  if (new Set(images.map((image) => image.id)).size !== images.length) throw new Error("Each reference image must be different.");
  const known = images.map((image) => image.digest).filter(Boolean);
  if (new Set(known).size !== known.length) throw new Error("Duplicate photos cannot fill the five reference slots.");
}
