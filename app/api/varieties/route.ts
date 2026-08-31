import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { varietySchema } from "@/lib/validators";
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
    include: {
      imageUploadedBy: {
        select: { name: true }
      }
    }
  });

  return NextResponse.json(varieties);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const parsed = varietySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });
  if (!isAdmin(session.user.role) && (!parsed.data.imageUrl || !parsed.data.imageFeatures)) {
    return NextResponse.json({ message: "Upload an image before saving this variety." }, { status: 400 });
  }

  try {
    const variety = await prisma.coconutVariety.create({
      data: {
        ...parsed.data,
        imageUploadedById: parsed.data.imageFeatures || !isAdmin(session.user.role) ? session.user.id : undefined
      },
      include: {
        imageUploadedBy: {
          select: { name: true }
        }
      }
    });
    await prisma.activityLog.create({
      data: { action: "Created", entity: "CoconutVariety", entityId: variety.id, userId: session.user.id }
    });
    return NextResponse.json(variety, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "A variety with this name already exists. Please choose a different name." }, { status: 409 });
    }
    throw error;
  }
}
