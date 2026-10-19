import { z } from "zod";
import { embeddingSchema } from "@/lib/image-embedding";

export const SCREENING_MODEL = "Xenova/clip-vit-base-patch32";
export const ANALYSIS_VERSION = 2;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const screeningLabels = [
  "a photo of a coconut fruit",
  "a photo of a coconut tree or palm leaves without visible fruit",
  "a photo of another fruit or vegetable",
  "a photo of a person or an animal",
  "a photo of a manufactured object",
  "a photo of scenery, a document or a blank background"
] as const;
export const screeningSchema = z.object({
  model: z.literal(SCREENING_MODEL), version: z.literal(ANALYSIS_VERSION),
  embedding: embeddingSchema.optional(),
  scores: z.array(z.object({ label: z.enum(screeningLabels), score: z.number().finite().min(0).max(1) })).length(screeningLabels.length)
}).superRefine((value, ctx) => {
  if (new Set(value.scores.map((entry) => entry.label)).size !== screeningLabels.length || Math.abs(value.scores.reduce((sum, entry) => sum + entry.score, 0) - 1) > 0.02) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid screening scores" });
  }
});
export type Screening = z.infer<typeof screeningSchema>;

export function createImageScreener(load: () => Promise<(file: File) => Promise<unknown>>, timeoutMs = 180_000) {
  let cached: ReturnType<typeof load> | null = null;
  async function deadline<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Screening timeout")), timeoutMs); })]);
    } finally { if (timer) clearTimeout(timer); }
  }
  return async (file: File, progress: (message: string) => void): Promise<Screening> => {
    progress("Loading screening model. The first download may take a few minutes...");
    try {
      cached ??= load();
      const classify = await deadline(cached);
      progress("Checking whether this image shows coconut fruit...");
      return screeningSchema.parse(await deadline(classify(file)));
    } catch {
      cached = null;
      throw new Error("Unable to load or run image screening. Check your connection and retry.");
    }
  };
}
export function screeningOutcome(screening: Screening) {
  const [top, runnerUp] = [...screening.scores].sort((a, b) => b.score - a.score);
  if (top.score < 0.8 || top.score - runnerUp.score < 0.2) return "uncertain";
  return top.label === screeningLabels[0] ? "coconut" : "not_coconut";
}
export function imageValidationError(file: { type: string; size: number }) {
  if (!IMAGE_TYPES.includes(file.type)) return "Choose a JPEG, PNG or WebP image.";
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) return "Choose an image between 1 byte and 10 MB.";
  return null;
}
export async function imageHasValidSignature(file: File) {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (file.type === "image/png") return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v);
  if (file.type === "image/webp") return String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP";
  return false;
}
export function analysisSummary(value: unknown) {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const status = data.status === "possible_matches" ? "Possible matches" : data.status === "not_coconut" ? "Not coconut" : data.status === "uncertain" ? "Unable to determine" : "Legacy scan — not screened";
  const reviewed = data.review && typeof data.review === "object" ? data.review as Record<string, unknown> : {};
  const first = Array.isArray(data.comparisons) ? data.comparisons[0] as Record<string, unknown> | undefined : undefined;
  return { status, review: reviewed.status === "not_coconut" ? "Reviewed: not coconut" : reviewed.status === "corrected" ? "Reviewed: corrected variety" : "Not reviewed", similarity: first && typeof first.similarityPercent === "number" ? first.similarityPercent : null };
}
