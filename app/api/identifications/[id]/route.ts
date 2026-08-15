import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const correctionSchema = z.object({
  coconutVarietyId: z.string().min(1, "Coconut variety is required").optional(),
  isNotCoconut: z.boolean().optional()
}).refine((data) => data.isNotCoconut || data.coconutVarietyId, {
  message: "Select a coconut variety or mark the image as not coconut"
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.role)) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = correctionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid data" }, { status: 400 });
  }

  const existingHistory = await prisma.identificationHistory.findUnique({
    where: { id },
    select: {
      id: true,
      imageLabels: true,
      imageFeatures: true
    }
  });

  if (!existingHistory) {
    return NextResponse.json({ message: "Identification history not found" }, { status: 404 });
  }

  if (parsed.data.isNotCoconut) {
    const history = await prisma.identificationHistory.update({
      where: { id },
      data: {
        coconutVarietyId: null,
        confidence: 0,
        notes: "Admin-reviewed result: uploaded image is not coconut."
      }
    });

    if (existingHistory.imageFeatures) {
      await prisma.trainingExample.create({
        data: {
          imageLabels: existingHistory.imageLabels,
          imageFeatures: existingHistory.imageFeatures,
          isNotCoconut: true,
          sourceHistoryId: existingHistory.id,
          createdById: session.user.id
        }
      });
    }

    await prisma.activityLog.create({
      data: {
        action: "Marked Not Coconut",
        entity: "IdentificationHistory",
        entityId: history.id,
        userId: session.user.id,
        metadata: {
          trainingExampleCreated: Boolean(existingHistory.imageFeatures)
        }
      }
    });

    return NextResponse.json({ ok: true, history });
  }

  const variety = await prisma.coconutVariety.findUnique({
    where: { id: parsed.data.coconutVarietyId },
    select: { id: true, name: true }
  });

  if (!variety) {
    return NextResponse.json({ message: "Selected variety does not exist" }, { status: 404 });
  }

  const history = await prisma.identificationHistory.update({
    where: { id },
    data: {
      coconutVarietyId: variety.id,
      notes: `Admin-corrected identification: ${variety.name}`
    }
  });

  if (existingHistory.imageFeatures) {
    await prisma.trainingExample.create({
      data: {
        imageLabels: existingHistory.imageLabels,
        imageFeatures: existingHistory.imageFeatures,
        sourceHistoryId: existingHistory.id,
        coconutVarietyId: variety.id,
        createdById: session.user.id
      }
    });
  }

  await prisma.activityLog.create({
    data: {
      action: "Corrected",
      entity: "IdentificationHistory",
      entityId: history.id,
      userId: session.user.id,
      metadata: {
        coconutVarietyId: variety.id,
        coconutVarietyName: variety.name,
        trainingExampleCreated: Boolean(existingHistory.imageFeatures)
      }
    }
  });

  return NextResponse.json({ ok: true, history });
}
