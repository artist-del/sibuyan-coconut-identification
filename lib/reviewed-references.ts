import type { PrismaClient } from "@prisma/client";
import { fingerprintStoredImage, readFingerprint, type ImageFingerprint } from "@/lib/image-fingerprint";

type Example = { id: string; sourceHistoryId: string | null; imageFingerprint?: unknown; coconutVarietyId: string | null; isNotCoconut: boolean };
export type ReviewedReference = { fingerprint: ImageFingerprint; coconutVarietyId: string | null; isNotCoconut: boolean };

// Old corrections acquire a pixel reference from their saved upload, without
// requiring the admin to re-upload/review. Bound storage reads per request.
export async function loadReviewedReferences(db: PrismaClient, examples: Example[], readStored = fingerprintStoredImage): Promise<ReviewedReference[]> {
  const references: ReviewedReference[] = [];
  const missing: Example[] = [];
  for (const example of examples) {
    const fingerprint = readFingerprint(example.imageFingerprint);
    if (fingerprint) references.push({ fingerprint, coconutVarietyId: example.coconutVarietyId, isNotCoconut: example.isNotCoconut });
    else if (example.sourceHistoryId && missing.length < 4) missing.push(example);
  }
  if (!missing.length) return references;
  const histories = await db.identificationHistory.findMany({ where: { id: { in: missing.map((e) => e.sourceHistoryId!) } }, select: { id: true, analysis: true, uploadedImage: { select: { url: true } } } });
  const hydrated = await Promise.all(missing.map(async (example) => {
    const history = histories.find((h) => h.id === example.sourceHistoryId);
    if (!history) return null;
    const analysis = history.analysis && typeof history.analysis === "object" && !Array.isArray(history.analysis) ? history.analysis : {};
    const fingerprint = readFingerprint(analysis.fingerprint) ?? (history.uploadedImage ? await readStored(history.uploadedImage.url) : null);
    if (!fingerprint) return null;
    // A concurrent correction/deletion must not be overwritten or resurrected.
    const cached = await db.trainingExample.updateMany({ where: { id: example.id, sourceHistoryId: example.sourceHistoryId, ...(example.coconutVarietyId ? { coconutVarietyId: example.coconutVarietyId } : { OR: [{ coconutVarietyId: null }, { coconutVarietyId: { isSet: false } }] }), isNotCoconut: example.isNotCoconut }, data: { imageFingerprint: fingerprint } });
    return cached.count ? { fingerprint, coconutVarietyId: example.coconutVarietyId, isNotCoconut: example.isNotCoconut } : null;
  }));
  return [...references, ...hydrated.filter((r): r is ReviewedReference => r !== null)];
}
