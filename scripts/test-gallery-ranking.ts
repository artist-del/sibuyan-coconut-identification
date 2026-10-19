import assert from "node:assert/strict";
import type { CoconutVariety, PrismaClient } from "@prisma/client";
import { normalizeEmbedding, readEmbedding, cosineSimilarity, validateGallery } from "../lib/image-embedding";
import { rankVarietyImages } from "../lib/embedding-ranking";
import { resolveIdentification } from "../lib/identification-result";
import { saveGalleryVariety, galleryVarietySchema, publicVariety, cleanupGalleryImage } from "../lib/variety-gallery";
import { fingerprintImage } from "../lib/image-fingerprint";
import sharp from "sharp";

const owner = { id: "123456789012345678901234", role: "USER" };
const metadata = { name: "Test variety", description: "Description with more than twenty characters", characteristics: "Distinctive fruit characteristics", treeHeight: "Short", fruitColor: "Orange", averageYield: "100", locationFound: "Cagban" };
function vector(a: number, b = 0) { return normalizeEmbedding([a, b, ...Array(510).fill(0)]); }
const query = vector(1), orthogonal = vector(0, 1);
function fixture() {
  const rows = Array.from({ length: 6 }, (_, i) => ({ id: String(i + 1).padStart(24, "0"), uploaderId: owner.id, varietyId: null as string | null, deleting: false, url: `https://res.cloudinary.com/test/image/upload/v1/photo${i}.jpg`, publicId: `photo${i}`, position: i, features: "orange round smooth", embedding: query, fingerprint: { version: 1, digest: String(i).repeat(64), pixels: "ab".repeat(768), edges: "01".repeat(32), contrast: 20 } }));
  const state = { rows, record: null as (Record<string, unknown> & { id: string; imageUploadedById: string | null }) | null, logs: 0 };
  const includeImages = () => ({ ...state.record!, images: state.rows.filter((row) => row.varietyId === state.record?.id) });
  const db = {
    coconutVariety: {
      findUnique: async () => state.record ? includeImages() : null,
      findUniqueOrThrow: async () => includeImages(),
      findMany: async () => state.record?.imageUrl ? [{ imageUrl: state.record.imageUrl }] : [],
      create: async ({ data }: { data: Record<string, unknown> }) => { state.record = { id: "abcdefabcdefabcdefabcdef", imageUploadedById: owner.id, ...data }; return state.record; },
      update: async ({ data }: { data: Record<string, unknown> }) => { state.record = { ...state.record!, ...data }; return state.record; }
    },
    varietyImage: {
      findUnique: async ({ where }: { where: { id: string } }) => rows.find((row) => row.id === where.id),
      findMany: async ({ where }: { where?: { id?: { in?: string[]; not?: string } } }) => where?.id?.in ? rows.filter((row) => where.id!.in!.includes(row.id)) : rows.filter((row) => row.id !== where?.id?.not),
      updateMany: async ({ where, data }: { where: { varietyId: string | null; id: string | { notIn: string[] } }; data: { varietyId?: null; deleting?: boolean } }) => {
        const ids = where.id;
        const selected = rows.filter((row) => row.varietyId === where.varietyId && (typeof ids === "string" ? row.id === ids && !row.deleting : !ids.notIn.includes(row.id)));
        selected.forEach((row) => Object.assign(row, data)); return { count: selected.length };
      },
      update: async ({ where, data }: { where: { id: string }; data: { varietyId: string; position: number } }) => Object.assign(rows.find((row) => row.id === where.id)!, data),
      deleteMany: async ({ where }: { where: { id: string } }) => { const index = rows.findIndex((row) => row.id === where.id); if (index >= 0) rows.splice(index, 1); }
    },
    uploadedImage: { findMany: async () => [] },
    activityLog: { create: async () => { state.logs++; } },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db)
  };
  return { db: db as unknown as PrismaClient, state };
}
async function main() {
  assert.equal(readEmbedding({ ...query, values: [1] }), null);
  assert.equal(readEmbedding({ ...query, values: Array(512).fill(0) }), null);
  assert.ok(cosineSimilarity(query, query) > 0.999);
  assert.equal(cosineSimilarity(query, orthogonal), 0);
  assert.throws(() => validateGallery([]));
  assert.throws(() => validateGallery(Array.from({ length: 5 }, (_, i) => ({ id: String(i), digest: "same" }))));
  assert.equal(galleryVarietySchema.safeParse({ ...metadata, imageIds: ["bad"] }).success, false);
  assert.equal(galleryVarietySchema.safeParse({ ...metadata, imageUrl: "https://example.test/bypass.jpg" }).success, false);
  const varieties = Array.from({ length: 7 }, (_, i) => ({ ...metadata, id: String(i), imageUrl: `cover${i}`, images: [{ id: `image${i}`, url: `reference${i}`, embedding: vector(7 - i, i) }] } as unknown as CoconutVariety & { images: { id: string; url: string; embedding: unknown }[] }));
  const ranked = rankVarietyImages(query, varieties, []);
  assert.equal(ranked.length, 5); assert.equal(ranked[0].variety.id, "0");
  assert.equal(ranked[0].similarityPercent, 100); assert.equal(ranked[0].bestReferenceImageUrl, "reference0");
  assert.ok(ranked[0].similarity! > ranked[1].similarity!);
  assert.ok(!("embedding" in ranked[0].variety.images[0]));
  const raw = Buffer.alloc(64 * 64 * 3); for (let i = 0; i < raw.length; i++) raw[i] = i % 256;
  const fp = await fingerprintImage(await sharp(raw, { raw: { width: 64, height: 64, channels: 3 } }).png().toBuffer());
  const corrected = resolveIdentification("uncertain", { embedding: query }, fp, varieties, [], [{ fingerprint: fp, coconutVarietyId: "0", isNotCoconut: false }]);
  assert.equal(corrected.matches.length, 5, "Admin correction must not short-circuit all-variety ranking");
  assert.equal(resolveIdentification("not_coconut", { embedding: query }, fp, varieties, [], []).matches.length, 0);
  const incomplete = rankVarietyImages(query, [{ ...varieties[0], images: [] }], []);
  assert.equal(incomplete[0].similarityPercent, null);
  assert.equal(JSON.stringify(publicVariety({ images: [{ id: "x", url: "u", position: 0, embedding: query }] })).includes("values"), false);
  {
    const { db, state } = fixture();
    await assert.rejects(saveGalleryVariety(db, owner, metadata));
    const imageIds = state.rows.slice(0, 5).map((row) => row.id);
    const saved = await saveGalleryVariety(db, owner, { ...metadata, imageIds });
    assert.equal(saved.variety.images.length, 5); assert.equal(state.record!.imageUrl, state.rows[0].url);
    await saveGalleryVariety(db, owner, { ...metadata, name: "Updated metadata" }, state.record!.id);
    assert.equal(state.rows.filter((row) => row.varietyId).length, 5);
    const replaced = await saveGalleryVariety(db, owner, { ...metadata, imageIds: [...imageIds.slice(1), state.rows[5].id] }, state.record!.id, async () => { throw new Error("Synthetic storage outage"); });
    assert.equal(replaced.cleanupPending, true); assert.equal(state.rows[0].varietyId, null);
    await assert.rejects(saveGalleryVariety(db, { ...owner, id: "other" }, metadata, state.record!.id));
  }
  {
    const { db, state } = fixture();
    state.rows[0].uploaderId = "another-user";
    await assert.rejects(saveGalleryVariety(db, owner, { ...metadata, imageIds: state.rows.slice(0, 5).map((row) => row.id) }));
    assert.equal(state.record, null);
  }
  {
    const { db, state } = fixture();
    state.rows[0].deleting = true;
    await assert.rejects(saveGalleryVariety(db, owner, { ...metadata, imageIds: state.rows.slice(0, 5).map((row) => row.id) }));
    assert.equal(state.record, null, "A cleanup-claimed image cannot be attached to a variety");
  }
  {
    const { db, state } = fixture();
    state.rows[1].fingerprint = state.rows[0].fingerprint;
    await assert.rejects(saveGalleryVariety(db, owner, { ...metadata, imageIds: state.rows.slice(0, 5).map((row) => row.id) }));
    assert.equal(state.record, null);
  }
  {
    const { db, state } = fixture();
    state.record = { id: "legacy", imageUploadedById: owner.id, imageUrl: "old-photo" };
    await saveGalleryVariety(db, owner, metadata, "legacy");
    assert.equal(state.record.imageUrl, "old-photo", "Metadata edit must preserve incomplete legacy reference set");
  }
  {
    const { db, state } = fixture(); let deleted = 0;
    state.rows[0].varietyId = "attached";
    await assert.rejects(cleanupGalleryImage(db, owner, state.rows[0].id, async () => { deleted++; }));
    assert.equal(deleted, 0);
    state.rows[0].varietyId = null;
    await cleanupGalleryImage(db, owner, state.rows[0].id, async () => { deleted++; });
    assert.equal(deleted, 1);
  }
  console.log("Gallery and embedding ranking checks passed (mock database/storage, synthetic vectors/images only).");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
