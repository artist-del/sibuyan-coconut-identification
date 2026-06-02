import { Activity, Leaf, Users, UploadCloud } from "lucide-react";

import { DashboardChart } from "@/components/admin/dashboard-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [varieties, users, uploads, recent, logs] = await Promise.all([
    prisma.coconutVariety.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.count(),
    prisma.uploadedImage.count(),
    prisma.coconutVariety.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
    prisma.activityLog.findMany({ take: 5, orderBy: { createdAt: "desc" }, include: { user: true } })
  ]);

  const byLocation = Object.values(
    varieties.reduce<Record<string, { location: string; count: number }>>((acc, item) => {
      acc[item.locationFound] ??= { location: item.locationFound, count: 0 };
      acc[item.locationFound].count += 1;
      return acc;
    }, {})
  );

  const stats = [
    { label: "Total coconut varieties", value: varieties.length, icon: Leaf },
    { label: "Registered users", value: users, icon: Users },
    { label: "Uploaded images", value: uploads, icon: UploadCloud },
    { label: "Activity logs", value: logs.length, icon: Activity }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-normal">Dashboard</h1>
        <p className="text-muted-foreground">Overview of Cajidiocan coconut records and platform activity.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="text-3xl font-bold">{stat.value}</CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Varieties by location</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardChart data={byLocation} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recently added varieties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.locationFound}</p>
                </div>
                <Badge>{item.fruitColor}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Activity logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : null}
          {logs.map((log) => (
            <div key={log.id} className="rounded-md border p-3 text-sm">
              <span className="font-medium">{log.action}</span> {log.entity} by {log.user?.name ?? "System"}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
