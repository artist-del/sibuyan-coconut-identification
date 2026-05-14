"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Leaf, MapPin, Ruler, UploadCloud, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import * as mobilenet from "@tensorflow-models/mobilenet";
import "@tensorflow/tfjs";
import * as tmImage from "@teachablemachine/image";

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
  matchedFields: string[];
};

export function IdentifyForm() {
  const imageRef = useRef<HTMLImageElement>(null);
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
      const imageElement = imageRef.current;
      if (!imageElement) return;

      const model = await mobilenet.load();

      const predictions = await model.classify(imageElement);
      const labelText = predictions.map((p) => p.className.toLowerCase()).join(" ");

      console.log(predictions);

      const isCoconut = predictions.some((p) =>
        p.className.toLowerCase().includes("coconut")
      );

      if (isCoconut) {
        toast.success("✅ This looks like a coconut.");
      } else {
        toast.error("❌ This is NOT recognized as a coconut.");
        return;
      }

      formData.append("imageLabels", labelText);
      const response = await fetch("/api/identify", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Identification failed");
        return;
      }

      setMatches(data.matches);
      toast.success("Identification complete");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Upload and describe sample</CardTitle>
          <CardDescription>Use a clear image and add field observations to match against real variety records.</CardDescription>
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fruitColor" className="flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-primary" /> Fruit color
                </Label>
                <Input id="fruitColor" name="fruitColor" placeholder="Green, yellow green, brown..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Location found
                </Label>
                <Input id="location" name="location" placeholder="Magdiwang, Cajidiocan..." />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="treeHeight" className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-primary" /> Approximate tree height
                </Label>
                <Input id="treeHeight" name="treeHeight" placeholder="Short, tall, 8-12 meters, 20 meters..." />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="observations">Other characteristics</Label>
                <Textarea
                  id="observations"
                  name="observations"
                  placeholder="Describe crown, nut size, yield, dwarf/tall habit, aroma, coastal or upland farm conditions..."
                />
              </div>
            </div>
            <Button className="w-full" type="submit" disabled={pending}>
              <Wand2 className="h-4 w-4" /> {pending ? "Analyzing..." : "Identify Coconut Variety"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recommended matches</CardTitle>
          <CardDescription>Matches are calculated from the coconut variety records saved in the database.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {matches.length === 0 ? <p className="text-sm text-muted-foreground">Upload an image and observations to see possible varieties.</p> : null}
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
