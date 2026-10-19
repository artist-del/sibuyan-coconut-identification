import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { embeddingSchema, readEmbedding } from "@/lib/image-embedding";
import { fingerprintStoredImage } from "@/lib/image-fingerprint";
import { assertVarietyOwner, cleanupGalleryImage } from "@/lib/variety-gallery";
import { cloudinaryAssetKey, IdentificationError } from "@/lib/identification-admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const varieties = await prisma.coconutVariety.findMany({ include: { images: true } });
  const examples = await prisma.trainingExample.findMany({ select: { id: true, sourceHistoryId: true, imageEmbedding: true } });
  const histories = await prisma.identificationHistory.findMany({ where: { id: { in: examples.filter((e) => !readEmbedding(e.imageEmbedding) && e.sourceHistoryId).map((e) => e.sourceHistoryId!) } }, select: { id: true, uploadedImage: { select: { url: true } } } });
  const items = varieties.flatMap((v) => v.images.length ? v.images.filter((image) => !readEmbedding(image.embedding)).map((image) => ({ kind: "variety", varietyId: v.id, imageId: image.id, url: image.url, label: v.name })) : v.imageUrl ? [{ kind: "variety", varietyId: v.id, imageId: "", url: v.imageUrl, label: v.name }] : []);
  const reviews = examples.filter((e) => !readEmbedding(e.imageEmbedding)).flatMap((e) => {
    const url = histories.find((h) => h.id === e.sourceHistoryId)?.uploadedImage?.url;
    return url ? [{ kind: "review", exampleId: e.id, url, label: "Reviewed scan" }] : [];
  });
  return NextResponse.json({ items: [...items, ...reviews] });
}
const schema = z.object({ kind: z.enum(["variety", "review"]), varietyId: z.string().regex(/^[a-f\d]{24}$/i).optional(), imageId: z.string().regex(/^[a-f\d]{24}$/i).optional(), exampleId: z.string().regex(/^[a-f\d]{24}$/i).optional(), url: z.string().url(), embedding: embeddingSchema });
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const unused = await prisma.varietyImage.findMany({ where: { varietyId: null, OR: [{ deleting: true }, { createdAt: { lt: new Date(Date.now() - 86_400_000) } }] }, take: 100, select: { id: true } });
  let removed = 0, pending = 0;
  for (const image of unused) { try { await cleanupGalleryImage(prisma, { id: session.user.id, role: "ADMIN" }, image.id); removed++; } catch { pending++; } }
  return NextResponse.json({ removed, pending });
}
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new IdentificationError(400, "Invalid reference metadata");
    const body = parsed.data;
    const actor = { id: session.user.id, role: session.user.role };
    if (body.kind === "review") {
      if (actor.role !== "ADMIN") throw new IdentificationError(403, "Forbidden");
      const example = body.exampleId ? await prisma.trainingExample.findUnique({ where: { id: body.exampleId } }) : null;
      const history = example?.sourceHistoryId ? await prisma.identificationHistory.findUnique({ where: { id: example.sourceHistoryId }, include: { uploadedImage: true } }) : null;
      if (!example || history?.uploadedImage?.url !== body.url) throw new IdentificationError(409, "Reference changed or its image is unavailable");
      const fingerprint = await fingerprintStoredImage(body.url);
      if (!fingerprint || fingerprint.contrast < 8) throw new IdentificationError(400, "Unable to read a usable reference image from storage");
      const result = await prisma.trainingExample.updateMany({ where: { id: example.id, sourceHistoryId: example.sourceHistoryId }, data: { imageEmbedding: body.embedding, imageFingerprint: fingerprint } });
      if (!result.count) throw new IdentificationError(409, "Reference changed; reload and retry");
      return NextResponse.json({ ok: true });
    }
    const variety = body.varietyId ? await prisma.coconutVariety.findUnique({ where: { id: body.varietyId }, include: { images: true } }) : null;
    if (!variety) throw new IdentificationError(404, "Variety not found");
    assertVarietyOwner(actor, variety.imageUploadedById);
    const image = body.imageId ? variety.images.find((row) => row.id === body.imageId) : variety.images.find((row) => row.url === variety.imageUrl);
    if (body.imageId && !image) throw new IdentificationError(404, "Reference image not found");
    if ((image?.url ?? variety.imageUrl) !== body.url || (!image && variety.images.length)) throw new IdentificationError(409, "Reference changed; reload and retry");
    const fingerprint = await fingerprintStoredImage(body.url);
    if (!fingerprint || fingerprint.contrast < 8) throw new IdentificationError(400, "Unable to read a usable reference image from storage");
    const key = cloudinaryAssetKey(body.url);
    const data = { fingerprint, embedding: body.embedding };
    const saved = await prisma.$transaction(async (tx) => {
      const current = await tx.coconutVariety.findUnique({ where: { id: variety.id }, include: { images: true } });
      if (!current) throw new IdentificationError(404, "Variety not found");
      assertVarietyOwner(actor, current.imageUploadedById);
      const target = image ? current.images.find((row) => row.id === image.id && row.url === body.url && !row.deleting) : current.images.find((row) => row.url === body.url && !row.deleting);
      if ((image && !target) || (!target && (current.images.length || current.imageUrl !== body.url))) throw new IdentificationError(409, "Image set changed. Reload and retry preparation.");
      // Serialize preparation with five-image saves; a stale legacy request
      // must never create a sixth photo after another editor completes a set.
      await tx.coconutVariety.update({ where: { id: current.id }, data: { updatedAt: new Date() } });
      return target ? tx.varietyImage.update({ where: { id: target.id }, data }) : tx.varietyImage.create({ data: { ...data, varietyId: current.id, uploaderId: actor.id, url: body.url, publicId: key ? key.slice(key.indexOf("/") + 1) : null, fileName: "Existing reference", features: current.imageFeatures, position: 0 } });
    });
    return NextResponse.json({ id: saved.id, url: saved.url, position: saved.position, ready: true });
  } catch (error) { return NextResponse.json({ message: error instanceof IdentificationError ? error.message : "Unable to prepare reference. Please retry." }, { status: error instanceof IdentificationError ? error.status : 503 }); }
}
