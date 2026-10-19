import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cleanupGalleryImage } from "@/lib/variety-gallery";
import { IdentificationError } from "@/lib/identification-admin";
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!/^[a-f\d]{24}$/i.test(id)) return NextResponse.json({ message: "Invalid image ID" }, { status: 400 });
  try { await cleanupGalleryImage(prisma, { id: session.user.id, role: session.user.role }, id); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ message: error instanceof IdentificationError ? error.message : "Cleanup is pending. Please retry." }, { status: error instanceof IdentificationError ? error.status : 503 }); }
}
