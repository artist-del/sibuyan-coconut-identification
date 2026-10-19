import assert from "node:assert/strict";
import type { CoconutVariety, PrismaClient } from "@prisma/client";
import { identifyCoconutFromRecords, findSimilarNotCoconutExample } from "../lib/identify-coconut";
import { ANALYSIS_VERSION, SCREENING_MODEL, screeningLabels, screeningSchema, screeningOutcome, imageValidationError, imageHasValidSignature, analysisSummary, createImageScreener, screeningFailureMessage } from "../lib/screening";
import { createScanRun } from "../lib/scan-run";
import { cloudinaryAssetKey, correctIdentification, deleteIdentification, IdentificationError, requireAdmin } from "../lib/identification-admin";
import { destroyCloudinaryImage } from "../lib/cloudinary";
import { extractImageFeatures } from "../lib/image-analysis";
import sharp from "sharp";
import { fingerprintImage, isNearDuplicate, readFingerprint } from "../lib/image-fingerprint";
import { resolveIdentification } from "../lib/identification-result";
import { loadReviewedReferences } from "../lib/reviewed-references";

const id = "123456789012345678901234";
const variety = { id, name: "Test", fruitColor: "green", imageFeatures: "green color round oval rough texture", description: "yellow color smooth texture elongated", locationFound: "brown", averageYield: "100" } as CoconutVariety;
function screening(top = 0, score = 0.9) {
  return screeningSchema.parse({ model: SCREENING_MODEL, version: ANALYSIS_VERSION, scores: screeningLabels.map((label, i) => ({ label, score: i === top ? score : (1 - score) / 5 })) });
}

function mockDatabase() {
  const state = {
    history: { id, imageFeatures: "green round rough", imageLabels: "coconut", analysis: null, uploadedImage: { id: "image", publicId: "identify_uploads/test", url: "https://res.cloudinary.com/demo/image/upload/v12/identify_uploads/test.jpg" } } as Record<string, unknown> | null,
    examples: [{ sourceHistoryId: id }, { sourceHistoryId: "other" }] as Record<string, unknown>[],
    uploads: [] as { url: string; publicId: string | null }[], varieties: [] as { imageUrl: string }[],
    destroyed: [] as string[], logs: 0, removedImages: 0, failTransaction: false
  };
  const client = {
    identificationHistory: {
      findUnique: async () => state.history,
      update: async ({ data }: { data: Record<string, unknown> }) => { state.history = { ...state.history, ...data }; return state.history; },
      deleteMany: async () => { const count = state.history ? 1 : 0; state.history = null; return { count }; }
    },
    uploadedImage: { findMany: async () => state.uploads, deleteMany: async () => { state.removedImages++; return { count: 1 }; } },
    varietyImage: { findMany: async () => [] },
    coconutVariety: { findMany: async () => state.varieties, findUnique: async () => variety },
    trainingExample: {
      deleteMany: async () => { state.examples = state.examples.filter((e) => e.sourceHistoryId !== id); },
      create: async ({ data }: { data: Record<string, unknown> }) => { state.examples.push(data); },
      updateMany: async () => { state.examples.forEach((e) => { if (e.sourceHistoryId === id) e.sourceHistoryId = null; }); }
    },
    activityLog: { create: async () => { state.logs++; } },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      if (state.failTransaction) throw new Error("Synthetic database failure");
      return fn(client);
    }
  };
  return { state, db: client as unknown as PrismaClient, destroy: async (key: string) => { state.destroyed.push(key); } };
}

async function main() {
  const raw = Buffer.alloc(96 * 80 * 3);
  for (let y = 0; y < 80; y++) for (let x = 0; x < 96; x++) { const p = (y * 96 + x) * 3; raw[p] = x * 2; raw[p + 1] = y * 3; raw[p + 2] = (x + y) % 256; }
  const image = await sharp(raw, { raw: { width: 96, height: 80, channels: 3 } }).png().toBuffer();
  const samePhoto = await sharp(image).resize(192, 160).jpeg({ quality: 90 }).toBuffer();
  const fp = await fingerprintImage(image), recompressed = await fingerprintImage(samePhoto);
  assert.ok(isNearDuplicate(fp, recompressed), "Same photo survives resizing/JPEG recompression");
  const different = await fingerprintImage(await sharp(image).rotate(180).png().toBuffer());
  assert.equal(isNearDuplicate(fp, different), false);
  const blankFp = await fingerprintImage(await sharp({ create: { width: 96, height: 80, channels: 3, background: "white" } }).png().toBuffer());
  assert.equal(isNearDuplicate(blankFp, blankFp), false);
  assert.equal(readFingerprint({ version: 1, pixels: "bad" }), null);
  const king = { ...variety, name: "King Coconut", fruitColor: "Orange", imageFeatures: "brown round rough" };
  const input = { imageFeatures: "orange oval smooth" };
  {
    const m = mockDatabase();
    await correctIdentification(m.db, id, id, { coconutVarietyId: id }, fp);
    const saved = m.state.examples.find((e) => e.sourceHistoryId === id)!;
    assert.deepEqual(saved.imageFingerprint, fp);
    const references = [{ fingerprint: readFingerprint(saved.imageFingerprint)!, coconutVarietyId: id, isNotCoconut: false }];
    assert.equal(resolveIdentification("uncertain", input, recompressed, [king], [], references).matches[0]?.variety.name, "King Coconut");
    assert.equal(resolveIdentification("uncertain", input, different, [king], [], references).status, "uncertain", "Coarse feature overlap cannot bypass screening");
    assert.equal(resolveIdentification("not_coconut", input, fp, [king], [], references).status, "possible_matches", "Same reviewed image can correct a model mistake");
    assert.equal(resolveIdentification("coconut", input, fp, [king], [], [{ ...references[0], isNotCoconut: true, coconutVarietyId: null }]).status, "not_coconut");
    assert.equal(resolveIdentification("uncertain", input, fp, [king], [], [...references, { ...references[0], isNotCoconut: true, coconutVarietyId: null }]).status, "uncertain");
    await deleteIdentification(m, id, id);
    assert.ok(m.state.examples.some((e) => e.imageFingerprint && e.sourceHistoryId === null), "Reviewed pixel reference survives scan deletion");
  }
  {
    let cached = false, calls = 0;
    const legacyDb = { identificationHistory: { findMany: async () => [{ id, analysis: null, uploadedImage: { url: "synthetic-reference" } }] }, trainingExample: { updateMany: async () => { cached = true; return { count: 1 }; } } } as unknown as PrismaClient;
    const refs = await loadReviewedReferences(legacyDb, [{ id: "legacy", sourceHistoryId: id, coconutVarietyId: id, isNotCoconut: false }], async () => { calls++; return fp; });
    assert.equal(cached, true); assert.equal(calls, 1);
    assert.equal(resolveIdentification("uncertain", input, fp, [king], [], refs).matches.length, 1, "Existing correction works without re-uploading");
    const existing = await loadReviewedReferences(legacyDb, [{ id: "cached", sourceHistoryId: null, imageFingerprint: fp, coconutVarietyId: id, isNotCoconut: false }], async () => { throw new Error("Must not fetch cached reference"); });
    assert.equal(existing.length, 1);
  }
  const runs = createScanRun();
  const old = runs.begin();
  const next = runs.begin();
  assert.equal(old.active(), false); assert.equal(old.signal.aborted, true); assert.equal(next.active(), true);
  runs.invalidate(); assert.equal(next.active(), false); assert.equal(next.signal.aborted, true);
  const file = new File(["synthetic"], "test.png", { type: "image/png" });
  let loads = 0;
  const screen = createImageScreener(async () => { loads++; if (loads === 1) throw new Error("Model missing"); return async () => screening(); });
  await assert.rejects(screen(file, () => {}), /retry/);
  assert.equal(screeningOutcome(await screen(file, () => {})), "coconut");
  await screen(file, () => {}); assert.equal(loads, 2);
  const stalled = createImageScreener(() => new Promise(() => {}), 5);
  await assert.rejects(stalled(file, () => {}), /retry/);
  const brokenInference = createImageScreener(async () => async () => { throw new Error("Inference unavailable"); });
  await assert.rejects(brokenInference(file, () => {}), /retry/);
  assert.match(screeningFailureMessage(new Error("WebAssembly CompileError"), "load"), /engine could not start/);
  assert.match(screeningFailureMessage(new Error("out of memory"), "run"), /ran out of memory/);
  assert.match(screeningFailureMessage(new Error("Failed to fetch"), "load"), /MODEL_NETWORK/);
  assert.match(screeningFailureMessage(new Error("Screening timeout"), "load"), /several minutes/);
  assert.ok(!screeningFailureMessage(new Error("private-internal-details"), "run").includes("private-internal-details"));
  assert.equal(screeningOutcome(screening()), "coconut");
  assert.equal(screeningOutcome(screening(3)), "not_coconut");
  assert.equal(screeningOutcome(screening(0, 0.6)), "uncertain");
  for (const index of [1, 2, 4, 5]) assert.equal(screeningOutcome(screening(index)), "not_coconut");
  assert.equal(screeningSchema.safeParse({ ...screening(), scores: Array(6).fill({ label: screeningLabels[0], score: 0.9 }) }).success, false);
  assert.ok(imageValidationError({ type: "text/plain", size: 20 }));
  assert.ok(imageValidationError({ type: "image/png", size: 11 * 1024 * 1024 }));
  assert.ok(imageValidationError({ type: "image/png", size: 0 }));
  assert.equal(imageValidationError({ type: "image/jpeg", size: 500 }), null);
  assert.equal(await imageHasValidSignature(new File(["not an image"], "fake.png", { type: "image/png" })), false);
  assert.equal(await imageHasValidSignature(new File([new Uint8Array([137,80,78,71,13,10,26,10])], "valid.png", { type: "image/png" })), true);
  const match = (features: string) => identifyCoconutFromRecords({ imageFeatures: features }, [variety]);
  assert.equal(match("color shape texture fruit coconut").length, 0);
  assert.equal(match("").length, 0);
  const blank = { width: 4, height: 4, getContext: () => ({ getImageData: () => ({ width: 4, height: 4, data: new Uint8ClampedArray(64).fill(255) }) }) } as unknown as HTMLCanvasElement;
  assert.equal(extractImageFeatures(blank), "");
  assert.equal(match("green").length, 0);
  assert.equal(match("yellow round rough").length, 0);
  assert.equal(identifyCoconutFromRecords({ imageFeatures: "yellow dark round rough" }, [{ ...variety, fruitColor: "green dark", imageFeatures: "green dark round rough" }]).length, 0);
  assert.equal(match("green elongated rough").length, 0);
  assert.equal(match("green round oval rough").length, 1);
  assert.ok(match("green round oval rough")[0].similarity <= 1);
  assert.ok(match("green round oval smooth")[0].similarity < match("green round oval rough")[0].similarity);
  assert.ok(!("confidence" in match("green round oval rough")[0]));
  assert.equal(identifyCoconutFromRecords({ imageFeatures: "yellow elongated smooth" }, [{ ...variety, fruitColor: "", imageFeatures: null }]).length, 0);
  assert.equal(findSimilarNotCoconutExample({ imageFeatures: "green rough" }, [{ imageFeatures: "green rough", isNotCoconut: true }]), false);
  assert.equal(analysisSummary(null).status, "Legacy scan — not screened");
  for (const session of [null, { user: { id, role: "USER" } }]) assert.throws(() => requireAdmin(session, id), IdentificationError);
  assert.throws(() => requireAdmin({ user: { id, role: "ADMIN" } }, "bad"), IdentificationError);
  assert.equal(requireAdmin({ user: { id, role: "ADMIN" } }, id), id);
  assert.equal(cloudinaryAssetKey("https://res.cloudinary.com/demo/image/upload/c_fill,w_200/v12/identify_uploads/test.jpg"), "demo/identify_uploads/test");
  assert.equal(cloudinaryAssetKey("https://res.cloudinary.com/demo/image/upload/v12/a_folder/test.jpg"), "demo/a_folder/test");
  {
    const m = mockDatabase();
    await correctIdentification(m.db, id, id, { coconutVarietyId: id });
    await correctIdentification(m.db, id, id, { isNotCoconut: true });
    assert.equal(m.state.examples.filter((e) => e.sourceHistoryId === id).length, 1);
    assert.equal(m.state.examples.find((e) => e.sourceHistoryId === id)?.isNotCoconut, true);
    await deleteIdentification(m, id, id);
    assert.equal(m.state.history, null);
    assert.equal(m.state.destroyed.length, 1);
    assert.equal(m.state.examples.length, 2);
    assert.ok(m.state.examples.some((e) => e.sourceHistoryId === null));
    await deleteIdentification(m, id, id);
    assert.equal(m.state.destroyed.length, 1);
  }
  for (const sharedType of ["upload", "variety"]) {
    const m = mockDatabase();
    if (sharedType === "upload") m.state.uploads.push({ publicId: "identify_uploads/test", url: "other" });
    else m.state.varieties.push({ imageUrl: "https://res.cloudinary.com/demo/image/upload/c_fill,w_200/v99/identify_uploads/test.png" });
    await deleteIdentification(m, id, id);
    assert.equal(m.state.destroyed.length, 0);
    assert.equal(m.state.history, null);
  }
  {
    const m = mockDatabase();
    m.state.history!.uploadedImage = null;
    await deleteIdentification(m, id, id);
    assert.equal(m.state.destroyed.length, 0); assert.equal(m.state.history, null);
  }
  {
    const m = mockDatabase();
    m.state.history!.uploadedImage = { id: "legacy", publicId: null, url: "https://example.test/unknown-image.jpg" };
    await assert.rejects(deleteIdentification(m, id, id), IdentificationError);
    assert.ok(m.state.history); assert.equal(m.state.destroyed.length, 0);
  }
  {
    const m = mockDatabase();
    await assert.rejects(deleteIdentification({ ...m, destroy: async () => { throw new Error("Synthetic storage failure"); } }, id, id), IdentificationError);
    assert.ok(m.state.history); assert.equal(m.state.logs, 0);
    m.state.failTransaction = true;
    await assert.rejects(deleteIdentification(m, id, id));
    assert.ok(m.state.history);
    m.state.failTransaction = false;
    await deleteIdentification(m, id, id);
    assert.equal(m.state.history, null);
  }
  // Storage signatures, missing assets, and safe errors without network calls.
  const originalFetch = globalThis.fetch;
  const originalEnv = Object.fromEntries(["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].map((key) => [key, process.env[key]]));
  try {
    process.env.CLOUDINARY_CLOUD_NAME = "test"; process.env.CLOUDINARY_API_KEY = "test"; process.env.CLOUDINARY_API_SECRET = "test";
    globalThis.fetch = async (_input, init) => {
      assert.equal((init?.body as URLSearchParams).get("invalidate"), "true");
      assert.ok((init?.body as URLSearchParams).get("signature"));
      return Response.json({ result: "not found" });
    };
    await destroyCloudinaryImage("identify_uploads/test");
    globalThis.fetch = async () => new Response("sensitive response", { status: 500 });
    await assert.rejects(destroyCloudinaryImage("test"), (error: Error) => !error.message.includes("sensitive"));
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  console.log("Identification regression checks passed (synthetic images/scores and mocked database/storage only).");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
