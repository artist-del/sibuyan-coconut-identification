import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { varietySchema } from "@/lib/validators";
import { readEmbedding, validateGallery } from "@/lib/image-embedding";
import { readFingerprint } from "@/lib/image-fingerprint";
import { destroyCloudinaryImage } from "@/lib/cloudinary";
import { IdentificationError, cloudinaryAssetKey } from "@/lib/identification-admin";

export const galleryVarietySchema = varietySchema.omit({ imageUrl: true, imageFeatures: true, imageLabels: true }).extend({ imageIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).length(5).optional() }).strict();
export type GalleryVarietyInput = z.infer<typeof galleryVarietySchema>;
export type GalleryActor = { id: string; role: string };
export function varietySaveFailure(error: unknown) {
  if (error instanceof IdentificationError) return { status: error.status, message: error.message };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { status: 409, message: "A variety with this name already exists. Please choose a different name. [P2002]" };
    if (error.code === "P2028") return { status: 503, message: "The database transaction did not complete. Keep this form open and retry. [P2028]" };
    if (error.code === "P2034") return { status: 409, message: "Another save conflicted with this update. Keep this form open and retry. [P2034]" };
    if (/^P\d{4}$/.test(error.code)) return { status: 503, message: `Unable to save variety. Please retry. [${error.code}]` };
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    const code = error.errorCode && /^P\d{4}$/.test(error.errorCode) ? error.errorCode : "SAVE_CONNECTION";
    return { status: 503, message: `Database connection could not start. Please retry. [${code}]` };
  }
  if (error instanceof Prisma.PrismaClientValidationError) return { status: 503, message: "Save data is incompatible with the deployed database client. Contact the developer. [SAVE_SCHEMA]" };
  return { status: 503, message: "Unable to save variety. Please retry. [SAVE_UNEXPECTED]" };
}
export const galleryInclude = { imageUploadedBy: { select: { name: true } }, images: { orderBy: { position: "asc" as const }, select: { id: true, url: true, position: true, embedding: true } } };
export function publicVariety<T extends { images: { id: string; url: string; position: number; embedding: unknown }[] }>(variety: T) {
  return { ...variety, images: variety.images.map(({ id, url, position, embedding }) => ({ id, url, position, ready: Boolean(readEmbedding(embedding)) })) };
}
export function assertVarietyOwner(actor: GalleryActor, uploaderId: string | null) {
  if (actor.role !== "ADMIN" && actor.id !== uploaderId) throw new IdentificationError(403, "Forbidden");
}

export async function saveGalleryVariety(db: PrismaClient, actor: GalleryActor, data: GalleryVarietyInput, id?: string, cleanup = (client: PrismaClient, owner: GalleryActor, imageId: string) => cleanupGalleryImage(client, owner, imageId, undefined, true)) {
  const removed: string[] = [];
  const variety = await db.$transaction(async (tx) => {
    const existing = id ? await tx.coconutVariety.findUnique({ where: { id }, include: { images: true } }) : null;
    if (id && !existing) throw new IdentificationError(404, "Variety not found");
    if (existing) assertVarietyOwner(actor, existing.imageUploadedById);
    const { imageIds, ...metadata } = data;
    if (!id && !imageIds) throw new IdentificationError(400, "Add exactly five reference images.");
    const rows = imageIds ? await tx.varietyImage.findMany({ where: { id: { in: imageIds } } }) : [];
    if (imageIds) {
      if (rows.length !== 5) throw new IdentificationError(400, "One or more reference images are missing.");
      for (const row of rows) {
        if (row.deleting) throw new IdentificationError(409, "A selected image is being removed. Choose another image.");
        if (row.varietyId ? row.varietyId !== id : row.uploaderId !== actor.id) throw new IdentificationError(403, "A reference image belongs to another record or upload session.");
        if (!readEmbedding(row.embedding) || !readFingerprint(row.fingerprint)) throw new IdentificationError(400, "Process all five reference images before saving.");
      }
      try { validateGallery(imageIds.map((imageId) => ({ id: imageId, digest: readFingerprint(rows.find((row) => row.id === imageId)!.fingerprint)?.digest ?? null }))); }
      catch (error) { throw new IdentificationError(400, error instanceof Error ? error.message : "Invalid reference images"); }
    }
    const cover = imageIds ? rows.find((row) => row.id === imageIds[0])! : null;
    const savedData = { ...metadata, ...(cover ? { imageUrl: cover.url, imageFeatures: cover.features, imageLabels: "" } : {}) };
    const saved = existing ? await tx.coconutVariety.update({ where: { id }, data: savedData }) : await tx.coconutVariety.create({ data: { ...savedData, imageUploadedById: actor.id } });
    if (imageIds) {
      removed.push(...(existing?.images ?? []).filter((row) => !imageIds.includes(row.id)).map((row) => row.id));
      await tx.varietyImage.updateMany({ where: { varietyId: saved.id, id: { notIn: imageIds } }, data: { varietyId: null } });
      for (const [position, imageId] of imageIds.entries()) await tx.varietyImage.update({ where: { id: imageId }, data: { varietyId: saved.id, position } });
    }
    await tx.activityLog.create({ data: { action: existing ? "Updated" : "Created", entity: "CoconutVariety", entityId: saved.id, userId: actor.id, metadata: { referenceImagesChanged: Boolean(imageIds) } } });
    return tx.coconutVariety.findUniqueOrThrow({ where: { id: saved.id }, include: galleryInclude });
  // Five reference updates plus the audit write can exceed Prisma's 5 s default
  // on the deployed database. Keep them atomic within a bounded 15 s budget.
  }, { timeout: 15_000 });
  let cleanupPending = false;
  for (const imageId of removed) { try { await cleanup(db, actor, imageId); } catch { cleanupPending = true; } }
  return { variety: publicVariety(variety), cleanupPending };
}

export async function cleanupGalleryImage(db: PrismaClient, actor: GalleryActor, id: string, destroy = destroyCloudinaryImage, authorizedRemoval = false) {
  const image = await db.varietyImage.findUnique({ where: { id } });
  if (!image) return;
  if (image.varietyId) throw new IdentificationError(409, "Remove the image through Edit Variety first.");
  // Only saveGalleryVariety may supply this after validating ownership of the
  // parent variety and deriving the removed IDs inside its transaction.
  if (!authorizedRemoval) assertVarietyOwner(actor, image.uploaderId);
  if (!image.deleting) {
    const claimed = await db.varietyImage.updateMany({ where: { id, varietyId: null, deleting: false }, data: { deleting: true } });
    if (!claimed.count) throw new IdentificationError(409, "Image changed during cleanup. Retry when available.");
  }
  const [gallery, uploads, varieties] = await Promise.all([
    db.varietyImage.findMany({ where: { id: { not: id } }, select: { url: true, publicId: true } }),
    db.uploadedImage.findMany({ select: { url: true, publicId: true } }),
    db.coconutVariety.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } })
  ]);
  const key = cloudinaryAssetKey(image.url);
  const shared = [...gallery, ...uploads].some((other) => other.url === image.url || (image.publicId && other.publicId === image.publicId) || (key && cloudinaryAssetKey(other.url) === key)) || varieties.some((other) => other.imageUrl === image.url || (key && other.imageUrl && cloudinaryAssetKey(other.imageUrl) === key));
  if (!shared && image.publicId) await destroy(image.publicId);
  await db.varietyImage.deleteMany({ where: { id, varietyId: null, deleting: true } });
}
