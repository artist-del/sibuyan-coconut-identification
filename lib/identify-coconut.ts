import type { CoconutVariety } from "@prisma/client";

export type IdentificationInput = {
  imageLabels?: string;
  imageFeatures?: string;
};

export type TrainingExampleInput = {
  coconutVarietyId?: string | null;
  imageLabels?: string | null;
  imageFeatures: string;
  isNotCoconut?: boolean;
};

export type IdentificationMatch = {
  variety: CoconutVariety;
  confidence: number;
  reason: string;
  matchedFields: string[];
};

const stopWords = new Set([
  "and",
  "the",
  "with",
  "from",
  "coconut",
  "tree",
  "fruit",
  "palm",
  "image",
  "photo",
  "near",
  "found"
]);

export function identifyCoconutFromRecords(
  input: IdentificationInput,
  varieties: CoconutVariety[],
  trainingExamples: TrainingExampleInput[] = []
): IdentificationMatch[] {
  const observationText = normalize(
    [input.imageLabels, input.imageFeatures]
      .filter(Boolean)
      .join(" ")
  );
  const observationTokens = tokenize(observationText);
  const trainingMatches = scoreTrainingExamples(observationTokens, trainingExamples);

  return varieties
    .map((variety) => scoreVariety(variety, observationTokens, trainingMatches.get(variety.id) ?? 0))
    .filter((match) => match.matchedFields.length > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

export function findSimilarNotCoconutExample(
  input: IdentificationInput,
  trainingExamples: TrainingExampleInput[],
  threshold = 0.8
) {
  const observationTokens = tokenize([input.imageLabels, input.imageFeatures].filter(Boolean).join(" "));

  return trainingExamples
    .filter((example) => example.isNotCoconut)
    .some((example) => {
      const exampleTokens = tokenize([example.imageLabels, example.imageFeatures].filter(Boolean).join(" "));
      return jaccardSimilarity(observationTokens, exampleTokens) >= threshold;
    });
}

function scoreVariety(variety: CoconutVariety, observationTokens: string[], trainingBoost: number): IdentificationMatch {
  let score = 0;
  const matchedFields: string[] = [];
  const reasons: string[] = [];

  const searchableRecord = normalize(
    [
      variety.name,
      variety.localName,
      variety.scientificName,
      variety.description,
      variety.characteristics,
      variety.fruitColor,
      variety.locationFound,
      variety.treeHeight,
      variety.averageYield,
      variety.imageLabels,
      variety.imageFeatures
    ]
      .filter(Boolean)
      .join(" ")
  );

  const tokenHits = observationTokens.filter((token) => searchableRecord.includes(token));
  const uniqueTokenHits = [...new Set(tokenHits)];
  if (uniqueTokenHits.length > 0) {
    score += Math.min(92, uniqueTokenHits.length * 12);
    matchedFields.push("image features");
    reasons.push(`image features matched: ${uniqueTokenHits.slice(0, 5).join(", ")}`);
  }

  const savedImageSimilarity = jaccardSimilarity(observationTokens, tokenize([variety.imageLabels, variety.imageFeatures].filter(Boolean).join(" ")));
  if (savedImageSimilarity >= 0.8) {
    score += 82;
    matchedFields.push("saved variety image");
    reasons.push("very similar to the saved variety image");
  } else if (savedImageSimilarity >= 0.55) {
    score += 58;
    matchedFields.push("saved variety image");
    reasons.push("similar to the saved variety image");
  } else if (savedImageSimilarity >= 0.35) {
    score += 34;
    matchedFields.push("saved variety image");
    reasons.push("partly similar to the saved variety image");
  }

  if (trainingBoost > 0) {
    score += trainingBoost;
    matchedFields.push("admin correction");
    reasons.push(`similar to admin-corrected image examples`);
  }

  return {
    variety,
    confidence: Math.min(100, Math.max(0, Math.round(score))),
    reason: reasons.join("; "),
    matchedFields
  };
}

function scoreTrainingExamples(observationTokens: string[], trainingExamples: TrainingExampleInput[]) {
  const boosts = new Map<string, number>();

  for (const example of trainingExamples) {
    if (example.isNotCoconut || !example.coconutVarietyId) continue;

    const exampleTokens = tokenize([example.imageLabels, example.imageFeatures].filter(Boolean).join(" "));
    const similarity = jaccardSimilarity(observationTokens, exampleTokens);
    if (similarity <= 0) continue;

    const boost = similarity >= 0.8 ? 70 : Math.round(similarity * 55);
    const existing = boosts.get(example.coconutVarietyId) ?? 0;
    boosts.set(example.coconutVarietyId, Math.max(existing, boost));
  }

  return boosts;
}

function jaccardSimilarity(first: string[], second: string[]) {
  const firstSet = new Set(first);
  const secondSet = new Set(second);
  if (firstSet.size === 0 || secondSet.size === 0) return 0;

  const intersection = [...firstSet].filter((token) => secondSet.has(token)).length;
  const union = new Set([...firstSet, ...secondSet]).size;
  return intersection / union;
}

function tokenize(value: string) {
  return normalize(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}
