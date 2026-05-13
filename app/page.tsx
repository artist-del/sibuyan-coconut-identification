import { BarChart3, Leaf, MapPin, Sprout } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [varietyCount, userCount, featured] = await Promise.all([
    prisma.coconutVariety.count().catch(() => 0),
    prisma.user.count().catch(() => 0),
    prisma.coconutVariety.findMany({ take: 3, orderBy: { createdAt: "desc" } }).catch(() => [])
  ]);

  const stats = [
    { label: "Documented varieties", value: varietyCount || 6, icon: Leaf },
    { label: "Barangay locations", value: 9, icon: MapPin },
    { label: "Registered users", value: userCount, icon: BarChart3 },
    { label: "Identification workflow", value: "AI-ready", icon: Sprout }
  ];

  return (
    <main>
      <SiteHeader />
      <Hero />
      <section className="bg-background py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8">
          <div>
            <Badge className="border-primary/20 bg-primary/10 text-primary">About the system</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-normal">Built for agricultural record keeping and field identification.</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              The system centralizes coconut variety profiles, upload history, and mock identification results in one
              secure dashboard. It is structured so a future machine learning model can replace the placeholder matching service.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader>
                  <stat.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-3xl">{stat.value}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{stat.label}</CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-secondary/45 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <Badge className="border-accent/20 bg-accent/10 text-accent">Sibuyan coconut farming</Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-normal">A practical catalog for island-based production contexts.</h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Sibuyan farms include coastal and upland planting areas where fruit color, palm height, yield, and location
              notes help agriculture staff compare varieties and advise growers.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {(featured.length ? featured : fallbackVarieties).map((item) => (
              <Card key={item.name} className="overflow-hidden">
                <div className="h-2 bg-primary" />
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{item.locationFound}</p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>{item.description}</p>
                  <Badge>{item.fruitColor}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t bg-background py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm text-muted-foreground sm:px-6 lg:px-8">
          <p className="font-semibold text-foreground">Sibuyan Coconut Identification System</p>
          <p>Municipal Agriculture Office support platform for Sibuyan Island, Romblon.</p>
          <p>Email: agriculture@sibuyan.gov.ph | Phone: +63 42 000 0000</p>
        </div>
      </footer>
    </main>
  );
}

const fallbackVarieties = [
  {
    name: "Sibuyan Tall",
    locationFound: "Magdiwang and Cajidiocan",
    description: "A locally observed tall type suitable for copra and household production.",
    fruitColor: "Green to brown"
  },
  {
    name: "Laguna Tall",
    locationFound: "San Fernando",
    description: "A vigorous tall coconut commonly used as a production reference variety.",
    fruitColor: "Green"
  },
  {
    name: "Tacunan Dwarf",
    locationFound: "Coastal barangays",
    description: "Compact palms with earlier bearing and yellow-green fruit color.",
    fruitColor: "Yellow green"
  }
];
