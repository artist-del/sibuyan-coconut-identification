import type { PrismaClient, Prisma } from "@prisma/client";
import type { destroyCloudinaryImage } from "@/lib/cloudinary";
import { readFingerprint, type ImageFingerprint } from "@/lib/image-fingerprint";
import { readEmbedding } from "@/lib/image-embedding";

type Dependencies = { db: PrismaClient; destroy: typeof destroyCloudinaryImage };
export class IdentificationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function requireAdmin(session: { user?: { id?: string; role?: string } } | null, id: string) {
  if (!session?.user?.id) throw new IdentificationError(401, "Unauthorized");
  if (session.user.role !== "ADMIN") throw new IdentificationError(403, "Forbidden");
  if (!/^[a-f\d]{24}$/i.test(id)) throw new IdentificationError(400, "Invalid scan ID");
  return session.user.id;
}
function jsonObject(value: Prisma.JsonValue | null): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

// Compare the asset identity, ignoring Cloudinary version/transformation segments.
export function cloudinaryAssetKey(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "res.cloudinary.com") return null;
    const match = parsed.pathname.match(/^\/([^/]+)\/image\/upload\/(.+)$/);
    if (!match) return null;
    const segments = match[2].split("/");
    const version = segments.findIndex((part) => /^v\d+$/.test(part));
    if (version >= 0) segments.splice(0, version + 1);
    // Only leading segments before the asset may describe transformations.
    else while (segments.length > 1 && /^(?:c|w|h|g|q|f|e|dpr|ar|b|r|a)_/.test(segments[0])) segments.shift();
    const asset = segments.join("/");
    return asset ? `${match[1]}/${decodeURIComponent(asset).replace(/\.[^/.]+$/, "")}` : null;
  } catch { return null; }
}

export async function deleteIdentification({ db, destroy }: Dependencies, id: string, userId: string) {
  const existing = await db.identificationHistory.findUnique({ where: { id }, include: { uploadedImage: true } });
  if (!existing) return; // Repeat deletion is safe.
  const image = existing.uploadedImage;
  if (image) {
    const key = cloudinaryAssetKey(image.url);
    const [uploads, varieties, gallery] = await Promise.all([
      db.uploadedImage.findMany({ where: { id: { not: image.id } }, select: { url: true, publicId: true } }),
      db.coconutVariety.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }),
      db.varietyImage.findMany({ select: { url: true, publicId: true } })
    ]);
    const shared = [...uploads, ...gallery].some((other) => (image.publicId && other.publicId === image.publicId) || other.url === image.url || (key && cloudinaryAssetKey(other.url) === key)) || varieties.some((other) => other.imageUrl === image.url || (key && other.imageUrl && cloudinaryAssetKey(other.imageUrl) === key));
    const publicId = image.publicId || (key ? key.slice(key.indexOf("/") + 1) : null);
    if (!shared && !publicId) throw new IdentificationError(409, "This legacy image cannot be safely located in storage. Scan retained for review.");
    if (!shared && publicId) {
      try { await destroy(publicId); }
      catch { throw new IdentificationError(503, "Unable to remove the stored image. Scan retained; please retry."); }
    }
  }
  await db.$transaction(async (tx) => {
    // Serialize with correction/deletion transactions by writing the history first.
    const deleted = await tx.identificationHistory.deleteMany({ where: { id } });
    if (!deleted.count) return;
    await tx.trainingExample.updateMany({ where: { sourceHistoryId: id }, data: { sourceHistoryId: null } });
    if (image) await tx.uploadedImage.deleteMany({ where: { id: image.id } });
    await tx.activityLog.create({ data: { action: "Deleted scan", entity: "IdentificationHistory", entityId: id, userId, metadata: { learningExamplesPreserved: true } } });
  });
}

export async function correctIdentification(db: PrismaClient, id: string, userId: string, correction: { isNotCoconut?: boolean; coconutVarietyId?: string }, suppliedFingerprint?: ImageFingerprint | null) {
  return db.$transaction(async (tx) => {
    const existing = await tx.identificationHistory.findUnique({ where: { id } });
    if (!existing) throw new IdentificationError(404, "Identification history not found");
    const variety = correction.isNotCoconut ? null : await tx.coconutVariety.findUnique({ where: { id: correction.coconutVarietyId } });
    if (!correction.isNotCoconut && !variety) throw new IdentificationError(404, "Selected variety does not exist");
    const review = { status: correction.isNotCoconut ? "not_coconut" : "corrected", reviewedBy: userId, reviewedAt: new Date().toISOString() };
    const fingerprint = suppliedFingerprint ?? readFingerprint(jsonObject(existing.analysis).fingerprint);
    const embedding = readEmbedding(jsonObject(existing.analysis).embedding);
    const history = await tx.identificationHistory.update({ where: { id }, data: {
      coconutVarietyId: variety?.id ?? null,
      ...(correction.isNotCoconut ? { confidence: 0 } : {}),
      notes: correction.isNotCoconut ? "Admin-reviewed result: uploaded image is not coconut." : `Admin-corrected identification: ${variety!.name}`,
      analysis: { ...jsonObject(existing.analysis), review, ...(fingerprint ? { fingerprint } : {}) }
    } });
    await tx.trainingExample.deleteMany({ where: { sourceHistoryId: id } });
    if (existing.imageFeatures) await tx.trainingExample.create({ data: {
      sourceHistoryId: id, imageLabels: existing.imageLabels, imageFeatures: existing.imageFeatures,
      ...(fingerprint ? { imageFingerprint: fingerprint } : {}),
      ...(embedding ? { imageEmbedding: embedding } : {}),
      isNotCoconut: Boolean(correction.isNotCoconut), coconutVarietyId: variety?.id ?? null, createdById: userId
    } });
    await tx.activityLog.create({ data: { action: correction.isNotCoconut ? "Marked Not Coconut" : "Corrected", entity: "IdentificationHistory", entityId: id, userId, metadata: { trainingExampleCreated: Boolean(existing.imageFeatures) } } });
    return history;
  });
}
