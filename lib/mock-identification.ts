import type { CoconutVariety } from "@prisma/client";

type IdentificationMatch = {
  variety: CoconutVariety;
  confidence: number;
  reason: string;
};

const signals = [
  { token: "green", color: "Green", bonus: 10 },
  { token: "yellow", color: "Yellow", bonus: 10 },
  { token: "dwarf", color: "Orange", bonus: 8 },
  { token: "tall", color: "Brown", bonus: 6 }
];

export function identifyCoconutMock(fileName: string, varieties: CoconutVariety[]): IdentificationMatch[] {
  const normalized = fileName.toLowerCase();

  return varieties
    .map((variety, index) => {
      const base = 62 + ((index * 7) % 18);
      const bonus = signals.reduce((score, signal) => {
        const hit = normalized.includes(signal.token) || variety.fruitColor.toLowerCase().includes(signal.color.toLowerCase());
        return score + (hit ? signal.bonus : 0);
      }, 0);

      return {
        variety,
        confidence: Math.min(96, base + bonus),
        reason: `${variety.fruitColor} fruit, ${variety.treeHeight.toLowerCase()} trees, and known presence in ${variety.locationFound}.`
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}
