import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { identifyCoconutFromRecords } from "@/lib/identify-coconut";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Image is required" }, { status: 400 });
  }

  const fruitColor = formData.get("fruitColor")?.toString();
  const location = formData.get("location")?.toString();
  const treeHeight = formData.get("treeHeight")?.toString();
  const observations = formData.get("observations")?.toString();

  const varieties = await prisma.coconutVariety.findMany({ orderBy: { name: "asc" } });
  if (varieties.length === 0) {
    return NextResponse.json({ message: "No coconut variety records are available yet." }, { status: 400 });
  }

  const matches = identifyCoconutFromRecords(
    {
      fileName: file.name,
      fruitColor,
      location,
      treeHeight,
      observations
    },
    varieties
  );
  const session = await getServerSession(authOptions);
  const uploadedImage = await prisma.uploadedImage.create({
    data: {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      url: `/uploads/${Date.now()}-${file.name}`,
      userId: session?.user.id
    }
  });

  await prisma.identificationHistory.create({
    data: {
      confidence: matches[0]?.confidence || 0,
      notes: `Record-based identification. Observations: ${[fruitColor, location, treeHeight, observations].filter(Boolean).join(" | ") || "image only"}`,
      userId: session?.user.id,
      uploadedImageId: uploadedImage.id,
      coconutVarietyId: matches[0]?.variety.id
    }
  });

  return NextResponse.json({ matches });
}
