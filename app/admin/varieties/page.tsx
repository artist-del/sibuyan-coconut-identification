import { VarietiesManager } from "@/components/admin/varieties-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminVarietiesPage() {
  const varieties = await prisma.coconutVariety.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      scientificName: true,
      localName: true,
      description: true,
      characteristics: true,
      treeHeight: true,
      fruitColor: true,
      averageYield: true,
      locationFound: true,
      imageUrl: true,
      imageLabels: true,
      imageFeatures: true,
      imageUploadedBy: { select: { name: true } }
    }
  });

  return <VarietiesManager initialVarieties={varieties} />;
}
