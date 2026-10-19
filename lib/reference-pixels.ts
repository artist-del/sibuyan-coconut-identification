import { fingerprintImage, fingerprintStoredImage, readFingerprint } from "@/lib/image-fingerprint";
import { imageHasValidSignature, imageValidationError } from "@/lib/screening";
import { IdentificationError } from "@/lib/identification-admin";

// Called only after the endpoint verifies the actor and current saved source.
// Embeddings remain advisory; this verifies usable pixels, not model accuracy
// or that browser-submitted pixels are identical to the remote source.
export async function referencePixels(file: File | null, url: string, cached?: unknown) {
  if (file) {
    const error = imageValidationError(file);
    if (error || !await imageHasValidSignature(file)) throw new IdentificationError(400, error || "Invalid reference image contents.");
    let fingerprint;
    try { fingerprint = await fingerprintImage(Buffer.from(await file.arrayBuffer())); }
    catch { throw new IdentificationError(400, "The saved reference could not be decoded. Replace it with a JPEG, PNG or WebP photo."); }
    if (fingerprint.contrast < 8) throw new IdentificationError(400, "The reference has too little visual detail. Choose a clearer photo.");
    return fingerprint;
  }
  const fingerprint = readFingerprint(cached) ?? await fingerprintStoredImage(url);
  if (!fingerprint) throw new IdentificationError(503, "The server could not read the saved photo. Refresh the page and retry preparation, or replace the photo in Edit Variety.");
  if (fingerprint.contrast < 8) throw new IdentificationError(400, "The reference has too little visual detail. Choose a clearer photo.");
  return fingerprint;
}
