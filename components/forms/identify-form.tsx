"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Eye, Maximize2, UploadCloud, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyzeImageFile, optimizeImageFile } from "@/lib/image-analysis";

type Match = {
  variety: {
    id: string;
    name: string;
    scientificName: string | null;
    localName: string | null;
    description: string;
    characteristics: string;
    locationFound: string;
    fruitColor: string;
    treeHeight: string;
    averageYield: string;
    imageUrl: string | null;
  };
  confidence: number;
  reason: string;
  matchedFields: string[];
};

export function IdentifyForm() {
  const [preview, setPreview] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [processSteps, setProcessSteps] = useState<string[]>([]);
  const [fullSizeImage, setFullSizeImage] = useState<{ url: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      if (!selectedFile) {
        toast.error("Choose an image first");
        return;
      }

      let imageAnalysis;
      try {
        imageAnalysis = await analyzeImageFile(selectedFile);
      } catch {
        toast.error("Unable to process this image. Try a smaller or clearer image.");
        return;
      }

      const optimizedFile = await optimizeImageFile(selectedFile);
      formData.set("image", optimizedFile);
      formData.append("imageLabels", imageAnalysis.labels);
      formData.append("imageFeatures", imageAnalysis.features);
      const response = await fetch("/api/identify", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Identification failed");
        return;
      }

      if (data.rejected) {
        setMatches([]);
        setProcessSteps(imageAnalysis.steps);
        toast.error(data.message || "Cannot identify because the uploaded image does not match a coconut image.");
        return;
      }

      if (data.matches.length === 0) {
        toast.error("No matching coconut variety found. Try a clearer coconut image.");
        return;
      }
      
      setProcessSteps(imageAnalysis.steps);
      setMatches(data.matches);
      toast.success("Identification complete");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Upload coconut image</CardTitle>
          <CardDescription>Identification uses only processed image features from the uploaded coconut image.</CardDescription>
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
            {processSteps.length > 0 ? (
              <div className="grid gap-2 rounded-lg border bg-secondary/30 p-3 text-sm">
                {processSteps.map((step) => (
                  <div key={step} className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{step}</span>
                    <Badge className="bg-background text-foreground">Done</Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recommended matches</CardTitle>
          <CardDescription>Matches are calculated from the coconut variety records saved in the database.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {matches.length === 0 ? <p className="text-sm text-muted-foreground">Upload a coconut image to see possible varieties.</p> : null}
          {matches.map((match, index) => (
            <div key={match.variety.id} className="rounded-lg border p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Match {index + 1}</p>
                  <h3 className="text-xl font-semibold">{match.variety.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{match.reason}</p>
                  {match.matchedFields.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {match.matchedFields.map((field) => (
                        <Badge key={field} className="bg-secondary text-secondary-foreground">{field}</Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Badge className="bg-primary text-primary-foreground">{match.confidence}% confidence</Badge>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        <Eye className="h-4 w-4" /> View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-4 sm:p-6">
                      <DialogHeader>
                        <DialogTitle>{match.variety.name}</DialogTitle>
                        <DialogDescription>
                          {match.variety.localName || match.variety.scientificName || "Coconut variety details"}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4">
                        {match.variety.imageUrl ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              className="relative h-56 w-full overflow-hidden rounded-md border bg-muted"
                              onClick={() => setFullSizeImage({ url: match.variety.imageUrl!, name: match.variety.name })}
                            >
                              <Image src={match.variety.imageUrl} alt={match.variety.name} fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover" />
                            </button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => setFullSizeImage({ url: match.variety.imageUrl!, name: match.variety.name })}
                            >
                              <Maximize2 className="h-4 w-4" /> View Full Size
                            </Button>
                          </div>
                        ) : null}
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <Detail label="Scientific name" value={match.variety.scientificName || "-"} />
                          <Detail label="Local name" value={match.variety.localName || "-"} />
                          <Detail label="Location" value={match.variety.locationFound} />
                          <Detail label="Fruit color" value={match.variety.fruitColor} />
                          <Detail label="Tree height" value={match.variety.treeHeight} />
                          <Detail label="Average yield" value={match.variety.averageYield} />
                        </div>
                        <Detail label="Description" value={match.variety.description} />
                        <Detail label="Characteristics" value={match.variety.characteristics} />
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
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
      <Dialog open={Boolean(fullSizeImage)} onOpenChange={(open) => !open && setFullSizeImage(null)}>
        <DialogContent className="max-h-[94vh] max-w-[min(96vw,1100px)] overflow-y-auto p-3 sm:p-4">
          <DialogHeader>
            <DialogTitle>{fullSizeImage?.name || "Variety image"}</DialogTitle>
            <DialogDescription>Full-size coconut variety image preview</DialogDescription>
          </DialogHeader>
          {fullSizeImage ? (
            <div className="flex max-h-[78vh] items-center justify-center overflow-auto rounded-md border bg-muted">
              <Image
                src={fullSizeImage.url}
                alt={fullSizeImage.name}
                width={1400}
                height={1000}
                className="h-auto max-h-[78vh] w-auto max-w-full object-contain"
                unoptimized
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
