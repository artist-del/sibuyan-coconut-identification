import { notFound } from "next/navigation";

import { VarietyForm } from "@/components/forms/variety-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EditVarietyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const variety = await prisma.coconutVariety.findUnique({ where: { id } });
  if (!variety) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">Edit Variety</h1>
        <p className="text-muted-foreground">Update coconut variety details and image metadata.</p>
      </div>
      <VarietyForm initial={variety} />
    </div>
  );
}
