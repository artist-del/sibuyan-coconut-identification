import Image from "next/image";

import { IdentificationReviewForm } from "@/components/admin/identification-review-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminIdentificationsPage() {
  const [histories, varieties, trainingExampleCount, notCoconutExampleCount] = await Promise.all([
    prisma.identificationHistory.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        uploadedImage: true,
        coconutVariety: true
      }
    }),
    prisma.coconutVariety.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.trainingExample.count(),
    prisma.trainingExample.count({ where: { isNotCoconut: true } })
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">Identifications</h1>
        <p className="text-muted-foreground">Review uploaded coconut images, confidence results, and correct matches.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent scans</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{histories.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Learning examples</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{trainingExampleCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Not coconut examples</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{notCoconutExampleCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Available varieties</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{varieties.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent scans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {histories.length === 0 ? <p className="text-sm text-muted-foreground">No identification history yet.</p> : null}
          {histories.map((history) => (
            <div key={history.id} className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[180px_1fr]">
              <div className="relative h-40 overflow-hidden rounded-md border bg-muted">
                {history.uploadedImage?.url ? (
                  <Image
                    src={history.uploadedImage.url}
                    alt={history.uploadedImage.fileName}
                    fill
                    sizes="180px"
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">No image</div>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {history.createdAt.toLocaleString()}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">
                      {history.coconutVariety?.name ?? "No matched variety"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Uploaded by {history.user?.name ?? "Guest"} {history.user?.email ? `(${history.user.email})` : ""}
                    </p>
                  </div>
                  <Badge className="w-fit bg-primary text-primary-foreground">{Math.round(history.confidence)}% confidence</Badge>
                </div>

                <p className="text-sm text-muted-foreground">{history.notes || "No analysis notes available."}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge>{history.imageFeatures ? "Learning ready" : "No stored features"}</Badge>
                  {history.coconutVariety?.name ? <Badge>{history.coconutVariety.name}</Badge> : <Badge>Not coconut / unresolved</Badge>}
                </div>

                <IdentificationReviewForm
                  historyId={history.id}
                  currentVarietyId={history.coconutVarietyId}
                  varieties={varieties}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
