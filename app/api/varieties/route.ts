import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { varietySchema } from "@/lib/validators";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const location = searchParams.get("location") || "";

  const varieties = await prisma.coconutVariety.findMany({
    where: {
      AND: [
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
    orderBy: { name: "asc" }
  });

  return NextResponse.json(varieties);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const parsed = varietySchema.safeParse(await request.json());
  console.log("Parsed data:", parsed);
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });

  const variety = await prisma.coconutVariety.create({ data: parsed.data });
  await prisma.activityLog.create({
    data: { action: "Created", entity: "CoconutVariety", entityId: variety.id, userId: session?.user.id }
  });

  return NextResponse.json(variety, { status: 201 });
}
