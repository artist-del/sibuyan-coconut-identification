import Link from "next/link";
import { Edit } from "lucide-react";

import { DeleteVarietyButton } from "@/components/admin/delete-variety-button";
import { ExportButtons } from "@/components/admin/export-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminVarietiesPage({ searchParams }: { searchParams: Promise<{ q?: string; location?: string; page?: string }> }) {
  const params = await searchParams;
  const page = Math.max(Number(params.page || 1), 1);
  const take = 8;
  const where = {
    AND: [
      params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: "insensitive" as const } },
              { localName: { contains: params.q, mode: "insensitive" as const } }
            ]
          }
        : {},
      params.location ? { locationFound: { contains: params.location, mode: "insensitive" as const } } : {}
    ]
  };

  const [varieties, total] = await Promise.all([
    prisma.coconutVariety.findMany({ where, orderBy: { createdAt: "desc" }, take, skip: (page - 1) * take }),
    prisma.coconutVariety.count({ where })
  ]);
  const pages = Math.max(Math.ceil(total / take), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">Coconut Varieties</h1>
          <p className="text-muted-foreground">Search, filter, edit, export, and delete Cajidiocan coconut records.</p>
        </div>
        <div className="flex gap-2">
          <ExportButtons />
          <Button asChild><Link href="/admin/varieties/new">Add Variety</Link></Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
          <form className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <Input name="q" placeholder="Search by variety or local name" defaultValue={params.q} />
            <Input name="location" placeholder="Filter by barangay/location" defaultValue={params.location} />
            <Button type="submit">Search</Button>
          </form>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr>
                <th className="py-3">Name</th>
                <th>Local name</th>
                <th>Location</th>
                <th>Fruit color</th>
                <th>Yield</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {varieties.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-4 font-medium">{item.name}</td>
                  <td>{item.localName || "-"}</td>
                  <td>{item.locationFound}</td>
                  <td>{item.fruitColor}</td>
                  <td>{item.averageYield}</td>
                  <td className="flex justify-end gap-2 py-3">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/varieties/${item.id}/edit`}><Edit className="h-4 w-4" /> Edit</Link>
                    </Button>
                    <DeleteVarietyButton id={item.id} name={item.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" aria-disabled={page <= 1}>
                <Link href={`/admin/varieties?page=${Math.max(page - 1, 1)}`}>Previous</Link>
              </Button>
              <Button asChild variant="outline" size="sm" aria-disabled={page >= pages}>
                <Link href={`/admin/varieties?page=${Math.min(page + 1, pages)}`}>Next</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
