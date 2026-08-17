"use client";

import { useMemo, useState } from "react";
import { Edit, PlusCircle, Search, X } from "lucide-react";

import { DeleteVarietyButton } from "@/components/admin/delete-variety-button";
import { ExportButtons } from "@/components/admin/export-buttons";
import { VarietyForm } from "@/components/forms/variety-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type AdminVariety = {
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
};

const PAGE_SIZE = 8;

export function VarietiesManager({ initialVarieties }: { initialVarieties: AdminVariety[] }) {
  const [varieties, setVarieties] = useState(initialVarieties);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdminVariety | null>(null);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedLocation = location.trim().toLowerCase();

    return varieties.filter((item) => {
      const matchesQuery = normalizedQuery
        ? [item.name, item.localName, item.scientificName].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedQuery))
        : true;
      const matchesLocation = normalizedLocation ? item.locationFound.toLowerCase().includes(normalizedLocation) : true;
      return matchesQuery && matchesLocation;
    });
  }, [location, query, varieties]);

  const pages = Math.max(Math.ceil(filtered.length / PAGE_SIZE), 1);
  const currentPage = Math.min(page, pages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function refreshVarieties() {
    const response = await fetch("/api/varieties", { cache: "no-store" });
    if (!response.ok) return;
    setVarieties(await response.json());
    setPage(1);
  }

  function clearSearch() {
    setQuery("");
    setLocation("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">Coconut Varieties</h1>
          <p className="text-muted-foreground">Search, filter, edit, export, and delete Cajidiocan coconut records.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButtons />
          <Button type="button" onClick={() => setAddOpen(true)}>
            <PlusCircle className="h-4 w-4" /> Add Variety
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
          <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
            <Input
              placeholder="Search by variety or local name"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
            <Input
              placeholder="Filter by barangay/location"
              value={location}
              onChange={(event) => {
                setLocation(event.target.value);
                setPage(1);
              }}
            />
            <div className="flex gap-2">
              <Button type="button" onClick={() => setPage(1)}>
                <Search className="h-4 w-4" /> Search
              </Button>
              <Button type="button" variant="outline" onClick={clearSearch} disabled={!query && !location}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
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
              {pageItems.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-4 font-medium">{item.name}</td>
                  <td>{item.localName || "-"}</td>
                  <td>{item.locationFound}</td>
                  <td>{item.fruitColor}</td>
                  <td>{item.averageYield}</td>
                  <td className="flex justify-end gap-2 py-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditing(item)}>
                      <Edit className="h-4 w-4" /> Edit
                    </Button>
                    <DeleteVarietyButton
                      id={item.id}
                      name={item.name}
                      onDeleted={() => setVarieties((current) => current.filter((variety) => variety.id !== item.id))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pageItems.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No records matched your filters.</p> : null}

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {currentPage} of {pages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>
                Previous
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(value + 1, pages))}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add coconut variety</DialogTitle>
            <DialogDescription>Create a coconut variety profile without leaving this page.</DialogDescription>
          </DialogHeader>
          <VarietyForm
            framed={false}
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
            <DialogDescription>Update coconut variety details without leaving this page.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <VarietyForm
              key={editing.id}
              initial={editing}
              framed={false}
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
