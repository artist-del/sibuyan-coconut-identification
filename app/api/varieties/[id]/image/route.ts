import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, isAdmin } from "@/lib/auth";
import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("image");
  const imageLabels = formData.get("imageLabels")?.toString();
  const imageFeatures = formData.get("imageFeatures")?.toString();

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Image file is required" }, { status: 400 });
  }

  const existing = await prisma.coconutVariety.findUnique({
    where: { id },
    select: { id: true, name: true, imageUploadedById: true }
  });

  if (!existing) {
    return NextResponse.json({ message: "Coconut variety not found" }, { status: 404 });
  }
  if (!isAdmin(session.user.role) && existing.imageUploadedById && existing.imageUploadedById !== session.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const upload = await uploadImageToCloudinary(file, "variety_uploads");
  const variety = await prisma.coconutVariety.update({
    where: { id },
    data: {
      imageUrl: upload.secure_url,
      imageLabels,
      imageFeatures,
      imageUploadedById: session.user.id
    },
    include: {
      imageUploadedBy: {
        select: { name: true }
      }
    }
  });

  await prisma.activityLog.create({
    data: {
      action: "Updated Image",
      entity: "CoconutVariety",
      entityId: variety.id,
      userId: session.user.id
    }
  });

  return NextResponse.json(variety);
}
