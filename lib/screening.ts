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

export function screeningFailureMessage(error: unknown, phase: "load" | "run") {
  // Inspect nested runtime causes locally, but never display their raw text:
  // messages can contain storage URLs, query strings, or device details.
  const details: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    if (typeof current === "string") { details.push(current); break; }
    if (typeof current !== "object") break;
    const entry = current as { name?: unknown; message?: unknown; cause?: unknown };
    if (typeof entry.name === "string") details.push(entry.name);
    if (typeof entry.message === "string") details.push(entry.message);
    current = entry.cause;
  }
  const detail = details.join(" ");
  if (/out of memory|memory access|allocation|array buffer|memory\.grow|bad_alloc/i.test(detail)) return "This browser ran out of memory while screening [MODEL_MEMORY]. Close other tabs, reload this page and retry with a smaller photo.";
  if (/no available backend|failed to create.*session|initialize.*backend|initWasm|wasm|webassembly|simd|SharedArrayBuffer|worker|compileerror/i.test(detail)) return "The image screening engine could not start in this browser [MODEL_ENGINE]. Update Chrome, reload the page and retry. On a phone, open the site over HTTPS.";
  if (/Failed to fetch|NetworkError|network request|Load failed|fetch failed/i.test(detail)) return "Model download failed [MODEL_NETWORK]. Chrome could not fetch a required model or engine file. Try this site in Chrome Incognito with the same connection, then retry. No image identification was completed.";
  if (/QuotaExceededError|CacheStorage|cache\.match|cache\.put|protobuf/i.test(detail)) return "Model cache recovery failed [MODEL_CACHE]. Chrome could not read or store the model. Free some device storage, reload the page and retry.";
  if (/timeout/i.test(detail)) return "Image screening took too long. Keep this tab open while the model downloads, then retry. The first download can take several minutes on mobile.";
  if (/importing a module|dynamically imported module|ChunkLoadError|loading chunk/i.test(detail)) return "The screening application files could not load [MODEL_APP_FILES]. Reload the page to get the current app version and retry.";
  return phase === "load" ? "Screening startup failed [MODEL_START_UNKNOWN]. The browser did not provide a recognized failure reason. Open the same site in Chrome Incognito, retry and report this code with your phone model and Chrome version." : "The screening model could not process this photo [MODEL_RUN_UNKNOWN]. Reload the page and retry with a smaller JPEG or PNG. If it continues, try an updated Chrome or Safari browser.";
}
export function createImageScreener(load: () => Promise<(file: File) => Promise<unknown>>, timeoutMs = 600_000) {
  let cached: ReturnType<typeof load> | null = null;
  async function deadline<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Screening timeout")), timeoutMs); })]);
    } finally { if (timer) clearTimeout(timer); }
  }
  return async (file: File, progress: (message: string) => void): Promise<Screening> => {
    let phase: "load" | "run" = "load";
    progress("Loading screening model. The first download may take a few minutes...");
    try {
      cached ??= load();
      const classify = await deadline(cached);
      phase = "run";
      progress("Checking whether this image shows coconut fruit...");
      return screeningSchema.parse(await deadline(classify(file)));
    } catch (error) {
      cached = null;
      throw new Error(screeningFailureMessage(error, phase));
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
