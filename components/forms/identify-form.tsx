"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Eye, Maximize2, UploadCloud, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyzeImageFile, optimizeImageFile, screenImageFile } from "@/lib/image-analysis";
import { imageValidationError } from "@/lib/screening";
import { createScanRun } from "@/lib/scan-run";
import { ReferenceGallery } from "@/components/ui/reference-gallery";

type Match = {
  similarityPercent?: number | null;
  bestReferenceImageUrl?: string | null;
  referenceCount?: number;
  reviewedReferenceMatch?: boolean;
  variety: {
    images?: { id: string; url: string }[];
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
  reason: string;
  matchedFields: string[];
};

export function IdentifyForm() {
  const [preview, setPreview] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [processSteps, setProcessSteps] = useState<string[]>([]);
  const [fullSizeImage, setFullSizeImage] = useState<{ url: string; name: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);
  const runs = useRef(createScanRun());
  useEffect(() => { const tracker = runs.current; return () => tracker.invalidate(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    runs.current.invalidate();
    setPending(false);
    setMatches([]); setResult(null); setProcessSteps([]); setProgress(""); setFullSizeImage(null);
    setSelectedFile(null); setPreview("");
    if (!file) return;
    const error = imageValidationError(file);
    if (error) { toast.error(error); event.target.value = ""; return; }
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) { toast.error("Choose an image first"); return; }
    const file = selectedFile;
    const { active, signal } = runs.current.begin();
    setMatches([]); setResult(null); setProcessSteps([]); setFullSizeImage(null);
    setPending(true);
    void (async () => {
      try {
        const screening = await screenImageFile(file, (text) => { if (active()) setProgress(text); });
        if (!active()) return;
        setProgress("Extracting visual traits and saving scan for review...");
        const imageAnalysis = await analyzeImageFile(file);
        if (!active()) return;
        const optimizedFile = await optimizeImageFile(file);
        if (!active()) return;
        const formData = new FormData();
        formData.set("image", optimizedFile);
        formData.set("imageFeatures", imageAnalysis.features);
        formData.set("screening", JSON.stringify(screening));
        const response = await fetch("/api/identify", { method: "POST", body: formData, signal });
        const data = await response.json().catch(() => null);
        if (!active()) return;
        if (!response.ok || !data) throw new Error(data?.message || "Unable to save this scan. Please retry.");
        setResult({ status: data.status, message: data.message });
        setMatches(data.matches);
        setProcessSteps(["Screening complete", "Visual traits extracted", "Scan saved for admin review"]);
      } catch (error) {
        if (!active()) return;
        setMatches([]); setProcessSteps([]);
        const message = error instanceof Error ? error.message : "Unable to process this image. Please retry.";
        setResult({ status: "error", message }); toast.error(message);
      } finally { if (active()) { setProgress(""); setPending(false); } }
    })();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Upload coconut image</CardTitle>
          <CardDescription>Screen coconut fruit first, then compare visual traits. The model downloads on first use and runs on your device. Scans are saved for admin review.</CardDescription>
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
              <Input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" required onChange={onFileChange} />
            </Label>
            <Button className="w-full" type="submit" disabled={pending}>
              <Wand2 className="h-4 w-4" /> {pending ? "Analyzing..." : "Identify Coconut Variety"}
            </Button>
            <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 10 MB. Screening is experimental and does not verify a variety.</p>
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{progress}</p>
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
          <CardTitle>{result?.status === "not_coconut" ? "Not coconut" : result?.status === "uncertain" ? "Unable to determine" : result?.status === "error" ? "Unable to process image" : "Top 5 visual comparisons"}</CardTitle>
          <CardDescription>Each variety is compared using its closest prepared reference photo. Similarity percentages are not identification confidence, and do not add up to 100%.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result ? <p role="status" className="text-sm text-muted-foreground">{result.message}</p> : <p className="text-sm text-muted-foreground">Upload a coconut image to see possible varieties.</p>}
          {matches.map((match, index) => (
            <div key={match.variety.id} className="rounded-lg border p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">{index === 0 ? "Closest available comparison" : `Alternative comparison ${index + 1}`}</p>
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
                  <Badge className="bg-primary text-primary-foreground">{match.similarityPercent == null ? "Needs preparation" : `${match.similarityPercent.toFixed(1)}% visual similarity`}</Badge>
                  {match.reviewedReferenceMatch ? <Badge>Reviewed reference match</Badge> : null}
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
                        {match.variety.images && match.variety.images.length > 1 ? <ReferenceGallery images={match.variety.images} cover={match.variety.imageUrl} name={match.variety.name} height="h-56" /> : null}
                        {match.variety.imageUrl && (!match.variety.images || match.variety.images.length <= 1) ? (
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
              {match.bestReferenceImageUrl ? <Image src={match.bestReferenceImageUrl} alt={`Closest reference for ${match.variety.name}`} width={240} height={160} className="mt-3 h-28 w-40 rounded-md border object-cover" /> : null}
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
