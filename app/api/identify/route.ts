import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { resolveIdentification } from "@/lib/identification-result";
import { fingerprintImage } from "@/lib/image-fingerprint";
import { loadReviewedReferences } from "@/lib/reviewed-references";
import { prisma } from "@/lib/prisma";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { imageHasValidSignature, imageValidationError, screeningSchema, screeningOutcome } from "@/lib/screening";

const featuresSchema = z.string().max(2000);
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) return NextResponse.json({ message: "Image is required" }, { status: 400 });
    const fileError = imageValidationError(file);
    if (fileError) return NextResponse.json({ message: fileError }, { status: 400 });
    if (!await imageHasValidSignature(file)) return NextResponse.json({ message: "The file contents do not match a supported image type." }, { status: 400 });
    const screening = screeningSchema.safeParse(JSON.parse(formData.get("screening")?.toString() || "null"));
    const features = featuresSchema.safeParse(formData.get("imageFeatures"));
    if (!screening.success || !screening.data.embedding || !features.success) return NextResponse.json({ message: "Invalid or outdated image analysis. Refresh the page and analyze the image again." }, { status: 400 });
    // Advisory browser evidence only: no claim that the server verified pixels.
    const outcome = screeningOutcome(screening.data);
    let fingerprint;
    try { fingerprint = await fingerprintImage(Buffer.from(await file.arrayBuffer())); }
    catch { return NextResponse.json({ message: "Unable to decode this image. Choose a valid JPEG, PNG or WebP photo." }, { status: 400 }); }
    const [varieties, examples] = await Promise.all([
      prisma.coconutVariety.findMany({ orderBy: { name: "asc" }, include: { images: true } }),
      prisma.trainingExample.findMany({ orderBy: { createdAt: "desc" } })
    ]);
    const input = { imageFeatures: features.data, embedding: screening.data.embedding };
    const references = await loadReviewedReferences(prisma, examples);
    const { negativeOverlap, matches, status, message, evidence } = resolveIdentification(outcome, input, fingerprint, varieties, examples, references);
    const session = await getServerSession(authOptions);
    const uploaded = await uploadImageToCloudinary(file, "identify_uploads");
    await prisma.$transaction(async (tx) => {
      const image = await tx.uploadedImage.create({ data: { fileName: file.name, mimeType: file.type, url: uploaded.secure_url, publicId: uploaded.public_id, userId: session?.user.id } });
      await tx.identificationHistory.create({ data: {
        confidence: matches[0]?.similarity ?? 0,
        notes: message, imageFeatures: features.data,
        imageLabels: screening.data.scores.slice().sort((a, b) => b.score - a.score)[0].label,
        uploadedImageId: image.id, userId: session?.user.id, coconutVarietyId: matches[0]?.variety.id,
        analysis: { version: 3, screening: screening.data, embedding: screening.data.embedding!, screeningOutcome: outcome, status, negativeOverlap, evidence, fingerprint, comparisons: matches.map((match) => ({ varietyId: match.variety.id, similarityPercent: "similarityPercent" in match && typeof match.similarityPercent === "number" ? match.similarityPercent : null })), scoreInterpretation: "cosine image similarity, not identification confidence", review: { status: "pending" } }
      } });
    });
    return NextResponse.json({ status, message, matches: matches.map(({ similarity: _similarity, ...match }) => match) });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ message: "Invalid image analysis." }, { status: 400 });
    return NextResponse.json({ message: "Unable to save this scan. Please retry." }, { status: 503 });
  }
}
