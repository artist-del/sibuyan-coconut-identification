import type { CoconutVariety } from "@prisma/client";
import { cosineSimilarity, readEmbedding, type ImageEmbedding } from "@/lib/image-embedding";
import type { TrainingExampleInput } from "@/lib/identify-coconut";
export type RankedVariety = CoconutVariety & { images?: { id: string; url: string; embedding: unknown; fingerprint?: unknown; position?: number }[] };
export function rankVarietyImages(input: ImageEmbedding, varieties: RankedVariety[], examples: TrainingExampleInput[], reviewedVarietyId?: string | null) {
  const comparisons = varieties.map((variety) => {
    const photos = (variety.images ?? []).flatMap((image) => { const embedding = readEmbedding(image.embedding); return embedding ? [{ embedding, url: image.url, reviewed: false }] : []; });
    const reviews = examples.filter((e) => !e.isNotCoconut && e.coconutVarietyId === variety.id).flatMap((e) => { const embedding = readEmbedding(e.imageEmbedding); return embedding ? [{ embedding, url: variety.imageUrl, reviewed: true }] : []; });
    const candidates = [...photos, ...reviews].map((reference) => ({ ...reference, similarity: cosineSimilarity(input, reference.embedding) })).sort((a, b) => b.similarity - a.similarity);
    const best = candidates[0];
    // Keep model vectors, fingerprints and private scan URLs out of public results.
    const { images, ...publicRecord } = variety;
    return { variety: { ...publicRecord, images: (images ?? []).map((image) => ({ id: image.id, url: image.url, position: image.position ?? 0 })) }, similarity: best?.similarity ?? null, similarityPercent: best ? Math.round(best.similarity * 1000) / 10 : null,
      bestReferenceImageUrl: best?.url ?? variety.imageUrl, referenceCount: candidates.length,
      reviewedReferenceMatch: reviewedVarietyId === variety.id,
      reason: best ? `Compared with ${candidates.length} prepared reference photo${candidates.length === 1 ? "" : "s"}. Score uses the closest ${best.reviewed ? "admin-reviewed" : "saved"} reference; it is not identification confidence.` : "No prepared image embeddings yet. An admin can prepare existing references.",
      matchedFields: best ? ["learned visual features"] : [] };
  });
  return comparisons.sort((a, b) => {
    if (a.reviewedReferenceMatch && a.similarity === null) return -1;
    if (b.reviewedReferenceMatch && b.similarity === null) return 1;
    return (b.similarity ?? -1) - (a.similarity ?? -1) || a.variety.name.localeCompare(b.variety.name);
  }).slice(0, 5);
}
