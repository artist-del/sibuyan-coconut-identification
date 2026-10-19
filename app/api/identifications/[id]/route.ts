import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { destroyCloudinaryImage } from "@/lib/cloudinary";
import { correctIdentification, deleteIdentification, IdentificationError, requireAdmin } from "@/lib/identification-admin";
import { fingerprintStoredImage, readFingerprint } from "@/lib/image-fingerprint";

const correctionSchema = z.object({
  coconutVarietyId: z.string().regex(/^[a-f\d]{24}$/i).optional(), isNotCoconut: z.boolean().optional()
}).refine((data) => Boolean(data.isNotCoconut) !== Boolean(data.coconutVarietyId), { message: "Select a variety or mark as not coconut" });
type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  if (error instanceof IdentificationError) return NextResponse.json({ message: error.message }, { status: error.status });
  return NextResponse.json({ message: "Unable to update this scan. Please retry." }, { status: 503 });
}
export async function PATCH(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const userId = requireAdmin(await getServerSession(authOptions), id);
    const parsed = correctionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: "Select a valid variety or mark as not coconut" }, { status: 400 });
    const existing = await prisma.identificationHistory.findUnique({ where: { id }, select: { analysis: true, uploadedImage: { select: { url: true } } } });
    if (!existing) throw new IdentificationError(404, "Identification history not found");
    const analysis = existing.analysis && typeof existing.analysis === "object" && !Array.isArray(existing.analysis) ? existing.analysis : {};
    const fingerprint = readFingerprint(analysis.fingerprint) ?? (existing.uploadedImage ? await fingerprintStoredImage(existing.uploadedImage.url) : null);
    await correctIdentification(prisma, id, userId, parsed.data, fingerprint);
    return NextResponse.json({ ok: true, referenceReady: Boolean(fingerprint) });
  } catch (error) { return failure(error); }
}
export async function DELETE(_request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const userId = requireAdmin(await getServerSession(authOptions), id);
    await deleteIdentification({ db: prisma, destroy: destroyCloudinaryImage }, id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
