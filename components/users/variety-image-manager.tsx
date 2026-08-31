"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Edit, ImagePlus, PlusCircle, Search, X } from "lucide-react";

import { VarietyForm } from "@/components/forms/variety-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type UserVariety = {
  id: string;
  name: string;
  scientificName: string | null;
  localName: string | null;
  description: string;
  characteristics: string;
  treeHeight: string;
  fruitColor: string;
  averageYield: string;
  locationFound: string;
  imageUrl: string | null;
  imageLabels: string | null;
  imageFeatures: string | null;
  imageUploadedBy: { name: string } | null;
};

export function VarietyImageManager({ initialVarieties }: { initialVarieties: UserVariety[] }) {
  const [varieties, setVarieties] = useState(initialVarieties);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<UserVariety | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return varieties;

    return varieties.filter((item) =>
      [item.name, item.localName, item.scientificName, item.locationFound].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedQuery))
    );
  }, [query, varieties]);

  async function refreshVarieties() {
    const response = await fetch("/api/varieties?mine=true", { cache: "no-store" });
    if (!response.ok) return;
    setVarieties(await response.json());
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-normal">My uploaded varieties</h2>
          <p className="text-sm text-muted-foreground">Add and edit the coconut variety records connected to your account.</p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          <PlusCircle className="h-4 w-4" /> Add Variety
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Input placeholder="Search your uploaded varieties" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="flex gap-2">
              <Button type="button">
                <Search className="h-4 w-4" /> Search
              </Button>
              <Button type="button" variant="outline" onClick={() => setQuery("")} disabled={!query}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((variety) => (
                <div key={variety.id} className="overflow-hidden rounded-lg border bg-card">
                  <div className="relative h-44 bg-muted">
                    {variety.imageUrl ? (
                      <Image src={variety.imageUrl} alt={variety.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-muted-foreground">No image</div>
                    )}
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <h3 className="font-semibold">{variety.name}</h3>
                      <p className="text-sm text-muted-foreground">{variety.localName || variety.scientificName || variety.locationFound}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{variety.fruitColor}</Badge>
                      <Badge>Uploaded by {variety.imageUploadedBy?.name || "Unknown user"}</Badge>
                    </div>
                    <Button type="button" className="w-full" variant="outline" onClick={() => setEditing(variety)}>
                      <Edit className="h-4 w-4" /> Edit Variety
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid min-h-52 place-items-center rounded-lg border border-dashed text-center">
              <div className="space-y-3">
                <ImagePlus className="mx-auto h-9 w-9 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{query ? "No uploaded variety matched your search." : "No uploaded varieties yet."}</p>
                <Button type="button" onClick={() => setAddOpen(true)}>
                  <PlusCircle className="h-4 w-4" /> Add Variety
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add coconut variety</DialogTitle>
            <DialogDescription>Upload a coconut variety record under your account.</DialogDescription>
          </DialogHeader>
          <VarietyForm
            framed={false}
            requireImage
            showImageUrlField={false}
            onSaved={async () => {
              setAddOpen(false);
              await refreshVarieties();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit coconut variety</DialogTitle>
            <DialogDescription>Update the variety record you uploaded.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <VarietyForm
              key={editing.id}
              initial={editing}
              framed={false}
              requireImage
              showImageUrlField={false}
              onSaved={async () => {
                setEditing(null);
                await refreshVarieties();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
