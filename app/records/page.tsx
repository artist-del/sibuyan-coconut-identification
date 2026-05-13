import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/landing/site-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ q?: string; location?: string }> }) {
  const params = await searchParams;
  const varieties = await prisma.coconutVariety.findMany({
    where: {
      AND: [
        params.q
          ? {
              OR: [
                { name: { contains: params.q, mode: "insensitive" } },
                { description: { contains: params.q, mode: "insensitive" } }
              ]
            }
          : {},
        params.location ? { locationFound: { contains: params.location, mode: "insensitive" } } : {}
      ]
    },
    orderBy: { name: "asc" }
  });

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-4xl font-semibold tracking-normal">Coconut Records</h1>
            <p className="mt-3 text-muted-foreground">Browse documented coconut varieties found in Sibuyan Island.</p>
          </div>
          <Button asChild><Link href="/identify">Identify Coconut Variety</Link></Button>
        </div>
        <form className="mt-8 grid gap-2 rounded-lg border bg-card p-4 md:grid-cols-[1fr_240px_auto]">
          <Input name="q" placeholder="Search records" defaultValue={params.q} />
          <Input name="location" placeholder="Location/barangay" defaultValue={params.location} />
          <Button type="submit"><Search className="h-4 w-4" /> Search</Button>
        </form>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {varieties.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="relative h-52 bg-muted">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">No image</div>
                )}
              </div>
              <CardHeader>
                <CardTitle>{item.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{item.localName || item.scientificName || "Sibuyan coconut variety"}</p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>{item.description}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge>{item.locationFound}</Badge>
                  <Badge>{item.fruitColor}</Badge>
                  <Badge>{item.averageYield}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {varieties.length === 0 ? <p className="mt-8 text-sm text-muted-foreground">No records matched your filters.</p> : null}
      </section>
    </main>
  );
}
