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
    const strongest = candidates.slice(0, 3);
    const similarity = strongest.length ? strongest.reduce((sum, reference) => sum + reference.similarity, 0) / strongest.length : null;
    // Keep model vectors, fingerprints and private scan URLs out of public results.
    const { images, ...publicRecord } = variety;
    return { variety: { ...publicRecord, images: (images ?? []).map((image) => ({ id: image.id, url: image.url, position: image.position ?? 0 })) }, similarity, similarityPercent: similarity === null ? null : Math.round(similarity * 1000) / 10,
      bestReferenceImageUrl: best?.url ?? variety.imageUrl, referenceCount: candidates.length,
      reviewedReferenceMatch: reviewedVarietyId === variety.id,
      reason: best ? `Compared with all ${candidates.length} prepared reference photo${candidates.length === 1 ? "" : "s"}. Score averages the ${strongest.length} closest references; the thumbnail shows the closest saved photo or the variety cover for a private reviewed scan. This is not identification confidence.` : "No prepared image embeddings yet. An admin can prepare existing references.",
      matchedFields: best ? ["learned visual features"] : [] };
  });
  return comparisons.sort((a, b) => {
    if (a.reviewedReferenceMatch && a.similarity === null) return -1;
    if (b.reviewedReferenceMatch && b.similarity === null) return 1;
    return (b.similarity ?? -1) - (a.similarity ?? -1) || a.variety.name.localeCompare(b.variety.name);
  }).slice(0, 5);
}
