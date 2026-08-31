"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Save, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzeImageFile, optimizeImageFile } from "@/lib/image-analysis";
import type { VarietyInput } from "@/lib/validators";

type Props = {
  initial?: {
    id?: string;
    name?: string;
    scientificName?: string | null;
    localName?: string | null;
    description?: string;
    characteristics?: string;
    treeHeight?: string;
    fruitColor?: string;
    averageYield?: string;
    locationFound?: string;
    imageUrl?: string | null;
    imageLabels?: string | null;
    imageFeatures?: string | null;
  };
  successRedirect?: string;
  onSaved?: () => void;
  framed?: boolean;
  requireImage?: boolean;
  showImageUrlField?: boolean;
};

export function VarietyForm({ initial, successRedirect, onSaved, framed = true, requireImage = false, showImageUrlField = true }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState(initial?.imageUrl || "");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    toast.info("Image preview ready. File will be uploaded to Cloudinary when saved.");
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConfirmOpen(true);
  }

  function saveVariety() {
    const form = formRef.current;
    if (!form) return;

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries()) as Record<string, string>;

    startTransition(async () => {
      if (requireImage && !selectedFile && !initial?.imageUrl) {
        toast.error("Upload an image before saving this variety.");
        return;
      }

      if (selectedFile) {
        const imageAnalysis = await analyzeImageFile(selectedFile).catch(() => null);
        if (!imageAnalysis) {
          toast.error("Unable to process the variety image. Try a smaller or clearer image.");
          return;
        }
        payload.imageLabels = imageAnalysis.labels;
        payload.imageFeatures = imageAnalysis.features;

        const optimizedFile = await optimizeImageFile(selectedFile);
        const uploadForm = new FormData();
        uploadForm.append("image", optimizedFile);

        const uploadResponse = await fetch("/api/cloudinary/upload", {
          method: "POST",
          body: uploadForm
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json().catch(() => ({ message: "Unable to upload image" }));
          toast.error(error.message || "Unable to upload image");
          return;
        }

        const uploadData = await uploadResponse.json();
        payload.imageUrl = uploadData.url || uploadData.secure_url || payload.imageUrl;
      }

      const response = await fetch(initial?.id ? `/api/varieties/${initial.id}` : "/api/varieties", {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Unable to save variety" }));
        toast.error(data.message);
        return;
      }

      toast.success(initial?.id ? "Variety updated" : "Variety created");
      setConfirmOpen(false);
      
      if (onSaved) {
        if (!initial?.id) {
          formRef.current?.reset();
          setPreview("");
          setSelectedFile(null);
        }
        onSaved();
        return;
      }

      if (!initial?.id && successRedirect) {
        formRef.current?.reset();
        setPreview("");
        setSelectedFile(null);
        return;
      }
      
      router.push(successRedirect ?? "/admin/varieties");
      router.refresh();
    });
  }

  const form = (
    <form ref={formRef} className="grid gap-5 lg:grid-cols-[1fr_320px]" onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="name" label="Variety name" defaultValue={initial?.name} required />
        <Field name="scientificName" label="Scientific name" defaultValue={initial?.scientificName} />
        <Field name="localName" label="Local name" defaultValue={initial?.localName} />
        <Field name="treeHeight" label="Tree height" defaultValue={initial?.treeHeight} required />
        <Field name="fruitColor" label="Fruit color" defaultValue={initial?.fruitColor} required />
        <Field name="averageYield" label="Average yield" defaultValue={initial?.averageYield} required />
        <Field name="locationFound" label="Location/barangay in Cajidiocan" defaultValue={initial?.locationFound} required />
        {showImageUrlField ? <Field name="imageUrl" label="Image URL" defaultValue={initial?.imageUrl} onChange={(value) => setPreview(value)} /> : null}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" required defaultValue={initial?.description} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="characteristics">Characteristics</Label>
          <Textarea id="characteristics" name="characteristics" required defaultValue={initial?.characteristics} />
        </div>
      </div>
      <div className="space-y-4">
        <div className="overflow-hidden rounded-lg border bg-muted">
          {preview ? (
            <Image src={preview} alt="Coconut preview" width={640} height={420} className="h-64 w-full object-cover" unoptimized />
          ) : (
            <div className="grid h-64 place-items-center text-sm text-muted-foreground">Image preview</div>
          )}
        </div>
        <Label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm">
          <Upload className="h-4 w-4" />
          Upload image preview
          <Input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </Label>
        <Button type="submit" className="w-full" disabled={pending}>
          <Save className="h-4 w-4" /> {pending ? "Saving..." : "Save variety"}
        </Button>
      </div>
    </form>
  );

  return (
    <>
      {framed ? (
        <Card>
          <CardHeader>
            <CardTitle>{initial?.id ? "Edit coconut variety" : "Add coconut variety"}</CardTitle>
          </CardHeader>
          <CardContent>{form}</CardContent>
        </Card>
      ) : (
        form
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{initial?.id ? "Confirm variety update" : "Confirm new variety"}</DialogTitle>
            <DialogDescription>
              {initial?.id
                ? "This will update the saved coconut variety record."
                : "This will save a new coconut variety record to the database."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={saveVariety} disabled={pending}>
              <Save className="h-4 w-4" /> {pending ? "Saving..." : "Confirm Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
  onChange
}: {
  name: keyof VarietyInput;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ""} required={required} onChange={(event) => onChange?.(event.target.value)} />
    </div>
  );
}
