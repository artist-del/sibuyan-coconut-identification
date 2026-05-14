import type { CoconutVariety } from "@prisma/client";

export type IdentificationInput = {
  fileName: string;
  fruitColor?: string;
  location?: string;
  treeHeight?: string;
  observations?: string;
  imageLabels?: string;
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

export function identifyCoconutFromRecords(input: IdentificationInput, varieties: CoconutVariety[]): IdentificationMatch[] {
  const observationText = normalize(
    [input.fileName, input.fruitColor, input.location, input.treeHeight, input.observations, input.imageLabels]
      .filter(Boolean)
      .join(" ")
  );
  const observationTokens = tokenize(observationText);

  return varieties
    .map((variety) => scoreVariety(variety, input, observationTokens))
    .filter((match) => match.matchedFields.length > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

function scoreVariety(variety: CoconutVariety, input: IdentificationInput, observationTokens: string[]): IdentificationMatch {
  let score = 0;
  const matchedFields: string[] = [];
  const reasons: string[] = [];

  if (input.fruitColor && fuzzyIncludes(variety.fruitColor, input.fruitColor)) {
    score += 24;
    matchedFields.push("fruit color");
    reasons.push(`fruit color is close to ${variety.fruitColor}`);
  }

  if (input.location && fuzzyIncludes(variety.locationFound, input.location)) {
    score += 22;
    matchedFields.push("location");
    reasons.push(`recorded in ${variety.locationFound}`);
  }

  if (input.treeHeight && fuzzyIncludes(variety.treeHeight, input.treeHeight)) {
    score += 16;
    matchedFields.push("tree height");
    reasons.push(`height profile matches ${variety.treeHeight}`);
  }

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
      variety.averageYield
    ]
      .filter(Boolean)
      .join(" ")
  );

  const tokenHits = observationTokens.filter((token) => searchableRecord.includes(token));
  const uniqueTokenHits = [...new Set(tokenHits)];
  if (uniqueTokenHits.length > 0) {
    score += Math.min(24, uniqueTokenHits.length * 4);
    matchedFields.push("observed traits");
    reasons.push(`matched traits: ${uniqueTokenHits.slice(0, 5).join(", ")}`);
  }

  return {
    variety,
    confidence: Math.min(98, Math.max(0, score)),
    reason: reasons.join("; "),
    matchedFields
  };
}

function fuzzyIncludes(recordValue: string, inputValue: string) {
  const record = normalize(recordValue);
  const input = normalize(inputValue);

  if (!record || !input) return false;
  return record.includes(input) || input.includes(record) || input.split(/\s+/).some((part) => part.length > 2 && record.includes(part));
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
