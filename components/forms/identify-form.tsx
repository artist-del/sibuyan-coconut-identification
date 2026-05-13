"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { UploadCloud, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Match = {
  variety: {
    id: string;
    name: string;
    description: string;
    characteristics: string;
    locationFound: string;
    fruitColor: string;
    treeHeight: string;
  };
  confidence: number;
  reason: string;
};

export function IdentifyForm() {
  const [preview, setPreview] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [pending, startTransition] = useTransition();

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const response = await fetch("/api/identify", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Identification failed");
        return;
      }

      setMatches(data.matches);
      toast.success("Mock identification complete");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Upload coconut image</CardTitle>
          <CardDescription>Use a clear image of the coconut fruit, crown, or whole palm.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="overflow-hidden rounded-lg border bg-muted">
              {preview ? (
                <Image src={preview} alt="Uploaded coconut preview" width={900} height={620} className="h-80 w-full object-cover" unoptimized />
              ) : (
                <div className="grid h-80 place-items-center text-sm text-muted-foreground">Image preview</div>
              )}
            </div>
            <Label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm">
              <UploadCloud className="h-4 w-4" />
              Choose image
              <Input name="image" type="file" accept="image/*" className="hidden" required onChange={onFileChange} />
            </Label>
            <Button className="w-full" type="submit" disabled={pending}>
              <Wand2 className="h-4 w-4" /> {pending ? "Analyzing..." : "Identify Coconut Variety"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recommended matches</CardTitle>
          <CardDescription>Placeholder matching now, ready to be replaced by an ML service later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {matches.length === 0 ? <p className="text-sm text-muted-foreground">Upload an image to see possible varieties.</p> : null}
          {matches.map((match, index) => (
            <div key={match.variety.id} className="rounded-lg border p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Match {index + 1}</p>
                  <h3 className="text-xl font-semibold">{match.variety.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{match.reason}</p>
                </div>
                <Badge className="bg-primary text-primary-foreground">{match.confidence}% confidence</Badge>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <p><span className="font-medium text-foreground">Location:</span> {match.variety.locationFound}</p>
                <p><span className="font-medium text-foreground">Fruit:</span> {match.variety.fruitColor}</p>
                <p><span className="font-medium text-foreground">Height:</span> {match.variety.treeHeight}</p>
                <p><span className="font-medium text-foreground">Traits:</span> {match.variety.characteristics}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
