import Link from "next/link";

import { RecordsBrowser } from "@/components/records/records-browser";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/landing/site-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const varieties = await prisma.coconutVariety.findMany({
    orderBy: { name: "asc" },
    include: {
      imageUploadedBy: {
        select: { name: true }
      }
    }
  });

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-normal">Coconut Records</h1>
            <p className="mt-3 text-muted-foreground">Browse documented coconut varieties found in Cajidiocan.</p>
          </div>
          <Button asChild><Link href="/identify">Identify Coconut Variety</Link></Button>
        </div>
        <RecordsBrowser initialVarieties={varieties} />
      </section>
    </main>
  );
}
