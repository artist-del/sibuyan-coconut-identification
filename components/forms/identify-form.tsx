"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Eye, UploadCloud, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as mobilenet from "@tensorflow-models/mobilenet";
import "@tensorflow/tfjs";

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

type ImageAnalysis = {
  features: string;
  steps: string[];
};

export function IdentifyForm() {
  const imageRef = useRef<HTMLImageElement>(null);
  const [preview, setPreview] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [processSteps, setProcessSteps] = useState<string[]>([]);
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
      const imageElement = imageRef.current;
      if (!imageElement) return;

      const model = await mobilenet.load();

      const predictions = await model.classify(imageElement);
      const labelText = predictions
        .filter((prediction) => prediction.probability >= 0.05)
        .map((prediction) => prediction.className.toLowerCase())
        .join(" ");
      const imageAnalysis = analyzeCoconutImage(imageElement);

      formData.append("imageLabels", labelText);
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
                <Image ref={imageRef} src={preview} alt="Uploaded coconut preview" width={900} height={620} className="h-80 w-full object-cover" unoptimized />
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
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{match.variety.name}</DialogTitle>
                        <DialogDescription>
                          {match.variety.localName || match.variety.scientificName || "Coconut variety details"}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4">
                        {match.variety.imageUrl ? (
                          <div className="relative h-56 overflow-hidden rounded-md border bg-muted">
                            <Image src={match.variety.imageUrl} alt={match.variety.name} fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover" />
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

function analyzeCoconutImage(imageElement: HTMLImageElement): ImageAnalysis {
  const processed = preprocessImage(imageElement);
  if (!processed) return { features: "", steps: [] };

  const colorFeatures = extractColorFeatures(processed);
  const shapeFeatures = extractShapeFeatures(processed);
  const textureFeatures = extractTextureFeatures(processed);

  return {
    features: [...colorFeatures, ...shapeFeatures, ...textureFeatures].join(" "),
    steps: [
      "Input coconut image",
      "Image pre-processing: resize, noise removal, image enhancement",
      `Feature extraction: ${[...shapeFeatures, ...colorFeatures, ...textureFeatures].join(", ")}`,
      "Classification: compare extracted image features with coconut records",
      "Output: ranked coconut variety matches"
    ]
  };
}

function preprocessImage(imageElement: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  const size = 224;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.filter = "contrast(1.08) saturate(1.08)";
  context.drawImage(imageElement, 0, 0, size, size);

  return context.getImageData(0, 0, size, size);
}

function extractColorFeatures(imageData: ImageData) {
  const pixels = imageData.data;
  const counts = {
    green: 0,
    yellow: 0,
    brown: 0,
    dark: 0,
    light: 0
  };

  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const alpha = pixels[index + 3];
    if (alpha < 128) continue;

    const brightness = (red + green + blue) / 3;
    if (brightness < 80) counts.dark += 1;
    if (brightness > 180) counts.light += 1;
    if (green > red * 1.1 && green > blue * 1.15) counts.green += 1;
    if (red > 120 && green > 100 && blue < 100 && Math.abs(red - green) < 90) counts.yellow += 1;
    if (red > 75 && green > 45 && green < 135 && blue < 95 && red > blue * 1.2) counts.brown += 1;
  }

  return Object.entries(counts)
    .sort(([, first], [, second]) => second - first)
    .filter(([, count]) => count > 0)
    .slice(0, 3)
    .map(([feature]) => feature)
    .map((feature) => `${feature} color`);
}

function extractShapeFeatures(imageData: ImageData) {
  const pixels = imageData.data;
  let foreground = 0;
  let minX = imageData.width;
  let minY = imageData.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const index = (y * imageData.width + x) * 4;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const brightness = (red + green + blue) / 3;
      const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);

      if (brightness < 230 && saturation > 18) {
        foreground += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (foreground === 0) return [];

  const width = Math.max(1, maxX - minX + 1);
  const height = Math.max(1, maxY - minY + 1);
  const coverage = foreground / (imageData.width * imageData.height);
  const aspectRatio = width / height;
  const features = ["coconut shape"];

  if (coverage > 0.18) features.push("large fruit");
  if (aspectRatio > 0.72 && aspectRatio < 1.35) features.push("round oval");
  if (aspectRatio >= 1.35) features.push("elongated");

  return features;
}

function extractTextureFeatures(imageData: ImageData) {
  const pixels = imageData.data;
  let edgeScore = 0;
  let comparisons = 0;

  for (let y = 1; y < imageData.height; y += 4) {
    for (let x = 1; x < imageData.width; x += 4) {
      const index = (y * imageData.width + x) * 4;
      const leftIndex = (y * imageData.width + x - 1) * 4;
      const topIndex = ((y - 1) * imageData.width + x) * 4;
      const current = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
      const left = (pixels[leftIndex] + pixels[leftIndex + 1] + pixels[leftIndex + 2]) / 3;
      const top = (pixels[topIndex] + pixels[topIndex + 1] + pixels[topIndex + 2]) / 3;

      edgeScore += Math.abs(current - left) + Math.abs(current - top);
      comparisons += 2;
    }
  }

  const averageEdge = comparisons ? edgeScore / comparisons : 0;
  if (averageEdge > 22) return ["rough texture"];
  if (averageEdge > 10) return ["moderate texture"];
  return ["smooth texture"];
}
