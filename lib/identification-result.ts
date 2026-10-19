import { identifyCoconutFromRecords, findSimilarNotCoconutExample, type IdentificationInput, type IdentificationMatch, type TrainingExampleInput } from "@/lib/identify-coconut";
import { isNearDuplicate, type ImageFingerprint } from "@/lib/image-fingerprint";
import type { ReviewedReference } from "@/lib/reviewed-references";
import { rankVarietyImages, type RankedVariety } from "@/lib/embedding-ranking";
import { readFingerprint } from "@/lib/image-fingerprint";

export function resolveIdentification(outcome: "coconut" | "not_coconut" | "uncertain", input: IdentificationInput, fingerprint: ImageFingerprint, varieties: RankedVariety[], examples: TrainingExampleInput[], references: ReviewedReference[]) {
  const galleryReferences = varieties.flatMap((variety) => (variety.images ?? []).flatMap((image) => { const saved = readFingerprint(image.fingerprint); return saved ? [{ fingerprint: saved, coconutVarietyId: variety.id, isNotCoconut: false }] : []; }));
  const nearby = [...references, ...galleryReferences].filter((r) => isNearDuplicate(fingerprint, r.fingerprint));
  const negatives = nearby.some((r) => r.isNotCoconut);
  const positives = new Set(nearby.filter((r) => !r.isNotCoconut && varieties.some((v) => v.id === r.coconutVarietyId)).map((r) => r.coconutVarietyId));
  const base = { negativeOverlap: false, evidence: "browser-advisory" };
  if ((negatives && positives.size) || positives.size > 1) return { ...base, evidence: "conflicting-reviewed-references", status: "uncertain", message: "Similar reviewed images have conflicting corrections. An admin needs to review these references.", matches: [] as IdentificationMatch[] };
  if (negatives) return { ...base, evidence: "reviewed-image-reference", status: "not_coconut", message: "This image closely matches a reference reviewed by an admin as not coconut.", matches: [] as IdentificationMatch[] };
  if (input.embedding) {
    if (outcome !== "coconut" && positives.size !== 1) return { ...base, status: outcome === "not_coconut" ? "not_coconut" : "uncertain", message: "Screening did not establish coconut fruit and there is no close known reference. An admin can review this scan.", matches: [] };
    const matches = rankVarietyImages(input.embedding, varieties, examples, positives.size === 1 ? [...positives][0] : null);
    return { ...base, evidence: "image-embedding-comparison", status: matches.some((match) => match.similarity !== null) || positives.size === 1 ? "possible_matches" : "uncertain", message: "Top available visual comparisons. Percentages measure image similarity, not the probability that a variety is correct. Lower-ranked alternatives may be unrelated. Unprepared varieties have no score.", matches };
  }
  if (positives.size === 1) {
    const variety = varieties.find((v) => positives.has(v.id))!;
    return { ...base, evidence: "reviewed-image-reference", status: "possible_matches", message: "This image closely matches an admin-reviewed reference. The suggested variety still needs verification for new photos.", matches: [{ variety, similarity: 1, reason: "Same or nearly identical image as an admin-reviewed reference. This is a reference match, not model confidence.", matchedFields: ["admin-reviewed reference image"] }] };
  }
  const negativeOverlap = outcome === "coconut" && findSimilarNotCoconutExample(input, examples);
  const matches = outcome === "coconut" && !negativeOverlap ? identifyCoconutFromRecords(input, varieties, examples) : [];
  const status = outcome === "not_coconut" ? "not_coconut" : matches.length ? "possible_matches" : "uncertain";
  const message = status === "not_coconut" ? "This image does not appear to show coconut fruit." : status === "possible_matches" ? "Possible varieties based on visual traits. These matches are not verified." : outcome === "coconut" ? "The image appears coconut-like, but there is not enough evidence to determine its variety." : "Screening is uncertain and this image does not closely match a reviewed reference. An admin can review this scan to add a reference.";
  return { ...base, negativeOverlap, status, message, matches };
}
