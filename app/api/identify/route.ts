import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { findSimilarNotCoconutExample, identifyCoconutFromRecords } from "@/lib/identify-coconut";
import { prisma } from "@/lib/prisma";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Image is required" }, { status: 400 });
  }

  const imageLabels = formData.get("imageLabels")?.toString();
  const imageFeatures = formData.get("imageFeatures")?.toString();

  const [varieties, trainingExamples] = await Promise.all([
    prisma.coconutVariety.findMany({ orderBy: { name: "asc" } }),
    prisma.trainingExample.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        coconutVarietyId: true,
        imageLabels: true,
        imageFeatures: true,
        isNotCoconut: true
      }
    })
  ]);
  if (varieties.length === 0) {
    return NextResponse.json({ message: "No coconut variety records are available yet." }, { status: 400 });
  }

  const identificationInput = {
    imageLabels,
    imageFeatures
  };
  const isKnownNotCoconut = findSimilarNotCoconutExample(identificationInput, trainingExamples);
  const matches = isKnownNotCoconut
    ? []
    : identifyCoconutFromRecords(
        identificationInput,
        varieties,
        trainingExamples
      );

  const uploaded = await uploadImageToCloudinary(file, "identify_uploads");
  const session = await getServerSession(authOptions);
  const uploadedImage = await prisma.uploadedImage.create({
    data: {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      userId: session?.user.id
    }
  });

  await prisma.identificationHistory.create({
    data: {
      confidence: matches[0]?.confidence || 0,
      notes: isKnownNotCoconut
        ? `Rejected by admin learning: image does not match coconut examples. Features: ${[imageLabels, imageFeatures].filter(Boolean).join(" | ") || "none"}`
        : `Image-based identification. Features: ${[imageLabels, imageFeatures].filter(Boolean).join(" | ") || "none"}`,
      imageLabels,
      imageFeatures,
      userId: session?.user.id,
      uploadedImageId: uploadedImage.id,
      coconutVarietyId: matches[0]?.variety.id
    }
  });

  if (isKnownNotCoconut) {
    return NextResponse.json({
      matches: [],
      rejected: true,
      message: "Cannot identify because the uploaded image does not match a coconut image."
    });
  }

  return NextResponse.json({ matches, rejected: false });
}
