"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type RecordVariety = {
  id: string;
  name: string;
  scientificName: string | null;
  localName: string | null;
  description: string;
  fruitColor: string;
  averageYield: string;
  locationFound: string;
  imageUrl: string | null;
  imageUploadedBy: { name: string } | null;
};

export function RecordsBrowser({ initialVarieties }: { initialVarieties: RecordVariety[] }) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [varieties, setVarieties] = useState(initialVarieties);
  const [isPending, startTransition] = useTransition();

  function searchRecords(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    startTransition(async () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (location.trim()) params.set("location", location.trim());

      const response = await fetch(`/api/varieties?${params.toString()}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        toast.error("Unable to search records");
        return;
      }

      setVarieties(await response.json());
    });
  }

  function clearSearch() {
    setQuery("");
    setLocation("");
    setVarieties(initialVarieties);
  }

  return (
    <>
      <form className="mt-8 grid gap-2 rounded-lg border bg-card p-4 md:grid-cols-[1fr_240px_auto_auto]" onSubmit={searchRecords}>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" />
        <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location/barangay" />
        <Button type="submit" disabled={isPending}>
          <Search className="h-4 w-4" /> {isPending ? "Searching..." : "Search"}
        </Button>
        <Button type="button" variant="outline" onClick={clearSearch} disabled={isPending || (!query && !location)}>
          <X className="h-4 w-4" /> Clear
        </Button>
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
              <p className="text-sm text-muted-foreground">{item.localName || item.scientificName || "Cajidiocan coconut variety"}</p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>{item.description}</p>
              <div className="flex flex-wrap gap-2">
                <Badge>{item.locationFound}</Badge>
                <Badge>{item.fruitColor}</Badge>
                <Badge>{item.averageYield}</Badge>
                {item.imageUploadedBy?.name ? <Badge>Uploaded by {item.imageUploadedBy.name}</Badge> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {varieties.length === 0 ? <p className="mt-8 text-sm text-muted-foreground">No records matched your filters.</p> : null}
    </>
  );
}
