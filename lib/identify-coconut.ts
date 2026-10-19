import type { CoconutVariety } from "@prisma/client";
import type { ImageEmbedding } from "@/lib/image-embedding";

export type IdentificationInput = { imageLabels?: string; imageFeatures?: string; embedding?: ImageEmbedding };
export type TrainingExampleInput = { coconutVarietyId?: string | null; imageLabels?: string | null; imageFeatures: string; isNotCoconut?: boolean; imageEmbedding?: unknown };
export type IdentificationMatch = { variety: CoconutVariety; similarity: number; reason: string; matchedFields: string[] };
const vocabulary = { color: ["green", "yellow", "orange", "brown", "dark", "light"], shape: ["round", "oval", "elongated"], texture: ["rough", "moderate", "smooth"] };
type Group = keyof typeof vocabulary;
type Features = Record<Group, Set<string>>;
function colorConflict(a: Set<string>, b: Set<string>) {
  const hues = new Set(["green", "yellow", "orange", "brown"]);
  const first = [...a].filter((v) => hues.has(v));
  const second = [...b].filter((v) => hues.has(v));
  return first.length > 0 && second.length > 0 && !first.some((v) => second.includes(v));
}
export function visualFeatures(text = ""): Features {
  const tokens = new Set(text.toLowerCase().split(/[^a-z]+/));
  return Object.fromEntries(Object.entries(vocabulary).map(([group, values]) => [group, new Set(values.filter((v) => tokens.has(v)))])) as Features;
}
function compare(input: Features, reference: Features) {
  const matchedFields: string[] = [];
  let total = 0, groups = 0, conflict = false;
  if (colorConflict(input.color, reference.color)) conflict = true;
  for (const group of Object.keys(vocabulary) as Group[]) {
    const a = input[group], b = reference[group];
    if (!a.size || !b.size) continue;
    groups++;
    const intersection = [...a].filter((v) => b.has(v)).length;
    if (!intersection && (group === "color" || group === "shape")) conflict = true;
    if (intersection) matchedFields.push(group);
    total += intersection / new Set([...a, ...b]).size;
  }
  return { similarity: groups ? total / groups : 0, matchedFields, conflict };
}
export function identifyCoconutFromRecords(input: IdentificationInput, varieties: CoconutVariety[], examples: TrainingExampleInput[] = []): IdentificationMatch[] {
  const observed = visualFeatures(input.imageFeatures);
  return varieties.flatMap((variety) => {
    const reference = visualFeatures(variety.imageFeatures ?? "");
    const recordColors = visualFeatures(variety.fruitColor).color;
    if (colorConflict(observed.color, recordColors)) return [];
    if (recordColors.size && observed.color.size && ![...observed.color].some((c) => recordColors.has(c))) return [];
    if (!reference.color.size) reference.color = recordColors;
    const base = compare(observed, reference);
    if (base.conflict) return [];
    const candidates = [{ ...base, source: "saved visual features" }, ...examples.filter((e) => !e.isNotCoconut && e.coconutVarietyId === variety.id).map((e) => ({ ...compare(observed, visualFeatures(e.imageFeatures)), source: "admin-reviewed visual example" }))];
    const best = candidates.filter((c) => !c.conflict && c.matchedFields.length >= 2).sort((a, b) => b.similarity - a.similarity)[0];
    if (!best) return [];
    return [{ variety, similarity: best.similarity, matchedFields: best.matchedFields, reason: `Possible match based on ${best.matchedFields.join(" and ")} from ${best.source}. Variety is not verified.` }];
  }).sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}
export function findSimilarNotCoconutExample(input: IdentificationInput, examples: TrainingExampleInput[], threshold = 0.8) {
  return examples.filter((e) => e.isNotCoconut).some((example) => {
    const result = compare(visualFeatures(input.imageFeatures), visualFeatures(example.imageFeatures));
    return !result.conflict && result.matchedFields.length === 3 && result.similarity >= threshold;
  });
}
