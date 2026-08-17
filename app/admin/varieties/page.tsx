import { VarietiesManager } from "@/components/admin/varieties-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminVarietiesPage() {
  const varieties = await prisma.coconutVariety.findMany({
    orderBy: { createdAt: "desc" }
  });

  return <VarietiesManager initialVarieties={varieties} />;
}
