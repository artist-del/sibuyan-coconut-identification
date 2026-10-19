import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { galleryInclude, galleryVarietySchema, publicVariety, saveGalleryVariety } from "@/lib/variety-gallery";
import { IdentificationError } from "@/lib/identification-admin";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const location = searchParams.get("location") || "";
  const mine = searchParams.get("mine") === "true";

  if (mine && !session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const varieties = await prisma.coconutVariety.findMany({
    where: {
      AND: [
        mine ? { imageUploadedById: session?.user.id } : {},
        q
          ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { localName: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { characteristics: { contains: q, mode: "insensitive" } }
            ]
          }
          : {},
        location ? { locationFound: { contains: location, mode: "insensitive" } } : {}
      ]
    },
    orderBy: { name: "asc" },
    include: galleryInclude
  });

  return NextResponse.json(varieties.map(publicVariety));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const parsed = galleryVarietySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });

  try {
    const result = await saveGalleryVariety(prisma, { id: session.user.id, role: session.user.role }, parsed.data);
    return NextResponse.json({ ...result.variety, cleanupPending: result.cleanupPending }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "A variety with this name already exists. Please choose a different name." }, { status: 409 });
    }
    return NextResponse.json({ message: error instanceof IdentificationError ? error.message : "Unable to save variety. Please retry." }, { status: error instanceof IdentificationError ? error.status : 503 });
  }
}
