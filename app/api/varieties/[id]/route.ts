import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { galleryInclude, galleryVarietySchema, publicVariety, saveGalleryVariety, cleanupGalleryImage } from "@/lib/variety-gallery";
import { IdentificationError } from "@/lib/identification-admin";
type Context = { params: Promise<{ id: string }> };
const validId = (id: string) => /^[a-f\d]{24}$/i.test(id);
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ message: "Invalid variety ID" }, { status: 400 });
  const variety = await prisma.coconutVariety.findUnique({ where: { id }, include: galleryInclude });
  if (!variety) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(publicVariety(variety));
}
export async function PATCH(request: Request, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ message: "Invalid variety ID" }, { status: 400 });
  const parsed = galleryVarietySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });
  try {
    const result = await saveGalleryVariety(prisma, { id: session.user.id, role: session.user.role }, parsed.data, id);
    return NextResponse.json({ ...result.variety, cleanupPending: result.cleanupPending });
  } catch (error) { return NextResponse.json({ message: error instanceof IdentificationError ? error.message : "Unable to save variety. Please retry." }, { status: error instanceof IdentificationError ? error.status : 503 }); }
}
export async function DELETE(_request: Request, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!validId(id)) return NextResponse.json({ message: "Invalid variety ID" }, { status: 400 });
  const images = await prisma.varietyImage.findMany({ where: { varietyId: id }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    await tx.varietyImage.updateMany({ where: { varietyId: id }, data: { varietyId: null } });
    await tx.coconutVariety.delete({ where: { id } });
    await tx.activityLog.create({ data: { action: "Deleted", entity: "CoconutVariety", entityId: id, userId: session.user.id } });
  });
  let cleanupPending = false;
  for (const image of images) { try { await cleanupGalleryImage(prisma, { id: session.user.id, role: "ADMIN" }, image.id); } catch { cleanupPending = true; } }
  return NextResponse.json({ ok: true, cleanupPending });
}
