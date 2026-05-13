import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { identifyCoconutMock } from "@/lib/mock-identification";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Image is required" }, { status: 400 });
  }

  const varieties = await prisma.coconutVariety.findMany({ orderBy: { name: "asc" } });
  if (varieties.length === 0) {
    return NextResponse.json({ message: "No coconut variety records are available yet." }, { status: 400 });
  }

  const matches = identifyCoconutMock(file.name, varieties);
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
      notes: "Mock AI identification result",
      userId: session?.user.id,
      uploadedImageId: uploadedImage.id,
      coconutVarietyId: matches[0]?.variety.id
    }
  });

  return NextResponse.json({ matches });
}
