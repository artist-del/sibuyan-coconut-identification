import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { embeddingSchema } from "@/lib/image-embedding";
import { fingerprintImage } from "@/lib/image-fingerprint";
import { imageHasValidSignature, imageValidationError } from "@/lib/screening";
import { uploadImageToCloudinary, destroyCloudinaryImage } from "@/lib/cloudinary";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.formData(), file = body.get("image");
    if (!(file instanceof File)) return NextResponse.json({ message: "Image required" }, { status: 400 });
    const error = imageValidationError(file);
    if (error || !await imageHasValidSignature(file)) return NextResponse.json({ message: error || "Invalid image contents" }, { status: 400 });
    const embedding = embeddingSchema.safeParse(JSON.parse(body.get("embedding")?.toString() || "null"));
    if (!embedding.success) return NextResponse.json({ message: "Process the image before uploading." }, { status: 400 });
    let fingerprint;
    try { fingerprint = await fingerprintImage(Buffer.from(await file.arrayBuffer())); }
    catch { return NextResponse.json({ message: "Unable to decode image" }, { status: 400 }); }
    if (fingerprint.contrast < 8) return NextResponse.json({ message: "Blank images cannot be reference photos." }, { status: 400 });
    const uploaded = await uploadImageToCloudinary(file, "variety_uploads");
    try {
      const image = await prisma.varietyImage.create({ data: { varietyId: null, uploaderId: session.user.id, url: uploaded.secure_url, publicId: uploaded.public_id, fileName: file.name, features: body.get("features")?.toString().slice(0, 2000), embedding: embedding.data, fingerprint } });
      return NextResponse.json({ id: image.id, url: image.url, position: 0, ready: true });
    } catch { await destroyCloudinaryImage(uploaded.public_id).catch(() => {}); throw new Error("Unable to stage image"); }
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ message: "Invalid image analysis. Process the image again." }, { status: 400 });
    return NextResponse.json({ message: "Unable to upload reference image. Please retry." }, { status: 503 });
  }
}
