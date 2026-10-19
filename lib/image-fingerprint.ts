import crypto from "node:crypto";
import sharp from "sharp";
import { z } from "zod";

// Server-derived pixels, not client-supplied labels. Near-duplicate matching is
// intentionally strict; this is not a general coconut recognition algorithm.
const fingerprintSchema = z.object({ version: z.literal(1), pixels: z.string().regex(/^[0-9a-f]{1536}$/), edges: z.string().regex(/^[01]{64}$/), contrast: z.number().finite().min(0).max(255), digest: z.string().regex(/^[0-9a-f]{64}$/) });
export type ImageFingerprint = z.infer<typeof fingerprintSchema>;
export function readFingerprint(value: unknown) { const parsed = fingerprintSchema.safeParse(value); return parsed.success ? parsed.data : null; }

export async function fingerprintImage(bytes: Buffer): Promise<ImageFingerprint> {
  const source = sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().flatten({ background: "white" }).toColourspace("srgb").removeAlpha();
  const pixels = await source.clone().resize(16, 16, { fit: "fill" }).raw().toBuffer();
  const gray = await source.clone().resize(9, 8, { fit: "fill" }).greyscale().toColourspace("b-w").raw().toBuffer();
  let edges = "";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) edges += gray[y * 9 + x] > gray[y * 9 + x + 1] ? "1" : "0";
  const mean = gray.reduce((sum, value) => sum + value, 0) / gray.length;
  const contrast = Math.sqrt(gray.reduce((sum, value) => sum + (value - mean) ** 2, 0) / gray.length);
  return { version: 1, pixels: pixels.toString("hex"), edges, contrast, digest: crypto.createHash("sha256").update(pixels).digest("hex") };
}

export function isNearDuplicate(first: ImageFingerprint, second: ImageFingerprint) {
  // Uniform pictures cannot act as positive references, even if byte-identical.
  if (Math.min(first.contrast, second.contrast) < 8) return false;
  if (first.digest === second.digest) return true;
  const a = Buffer.from(first.pixels, "hex"), b = Buffer.from(second.pixels, "hex");
  const error = a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / (a.length * 255);
  const distance = [...first.edges].filter((bit, i) => bit !== second.edges[i]).length;
  return error <= 0.025 && distance <= 4;
}

export async function fingerprintStoredImage(url: string) {
  try {
    const parsed = new URL(url);
    // Only read this project's configured Cloudinary account; never fetch user
    // URLs on arbitrary hosts, follow redirects, or log storage configuration.
    if (parsed.protocol !== "https:" || parsed.hostname !== "res.cloudinary.com" || parsed.username || parsed.password || parsed.port || !process.env.CLOUDINARY_CLOUD_NAME || parsed.pathname.split("/")[1] !== process.env.CLOUDINARY_CLOUD_NAME) return null;
    const response = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(4000) });
    if (!response.ok || !response.body) return null;
    const chunks: Uint8Array[] = [];
    let length = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 10 * 1024 * 1024) { await reader.cancel(); return null; }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    return await fingerprintImage(Buffer.concat(chunks));
  } catch { return null; }
}
