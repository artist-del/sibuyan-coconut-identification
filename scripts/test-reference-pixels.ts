import assert from "node:assert/strict";
import sharp from "sharp";
import { referencePixels } from "../lib/reference-pixels";
import { readFingerprint } from "../lib/image-fingerprint";

async function main() {
  const pixels = Buffer.alloc(80 * 64 * 3);
  for (let i = 0; i < pixels.length; i++) pixels[i] = i % 256;
  const bytes = await sharp(pixels, { raw: { width: 80, height: 64, channels: 3 } }).png().toBuffer();
  const file = new File([new Uint8Array(bytes)], "reference.png", { type: "image/png" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Storage network must not be used"); };
  try {
    const fingerprint = await referencePixels(file, "https://external.example.test/legacy.png");
    assert.ok(readFingerprint(fingerprint));
    assert.deepEqual(await referencePixels(null, "https://external.example.test/legacy.png", fingerprint), fingerprint);
    await assert.rejects(referencePixels(new File(["not an image"], "bad.png", { type: "image/png" }), "https://external.example.test/legacy.png"), /Invalid reference image contents/);
    const blank = await sharp({ create: { width: 64, height: 64, channels: 3, background: "white" } }).png().toBuffer();
    await assert.rejects(referencePixels(new File([new Uint8Array(blank)], "blank.png", { type: "image/png" }), "https://external.example.test/legacy.png"), /too little visual detail/);
    await assert.rejects(referencePixels(null, "https://external.example.test/legacy.png"), /Refresh the page/);
    console.log("Reference preparation pixel checks passed (synthetic images, no storage or database writes).");
  } finally { globalThis.fetch = originalFetch; }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
