import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { varietySchema } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const variety = await prisma.coconutVariety.findUnique({ where: { id } });
  if (!variety) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return NextResponse.json(variety);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = varietySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });

  const variety = await prisma.coconutVariety.update({ where: { id }, data: parsed.data });
  await prisma.activityLog.create({
    data: { action: "Updated", entity: "CoconutVariety", entityId: variety.id, userId: session?.user.id }
  });
  return NextResponse.json(variety);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session?.user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.coconutVariety.delete({ where: { id } });
  await prisma.activityLog.create({
    data: { action: "Deleted", entity: "CoconutVariety", entityId: id, userId: session?.user.id }
  });
  return NextResponse.json({ ok: true });
}
