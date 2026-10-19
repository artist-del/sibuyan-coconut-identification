"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Save, Upload, X, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { analyzeImageFile, extractImageEmbedding, optimizeImageFile } from "@/lib/image-analysis";
import { imageValidationError } from "@/lib/screening";
import { prepareStoredReference } from "@/lib/reference-client";
import type { GalleryImage } from "@/lib/image-embedding";
import type { VarietyInput } from "@/lib/validators";

type Initial = Omit<Partial<VarietyInput>, "imageUrl" | "imageFeatures" | "imageLabels"> & { id?: string; imageUrl?: string | null; imageFeatures?: string | null; imageLabels?: string | null; images?: GalleryImage[] };
type Props = { initial?: Omit<Initial, "scientificName" | "localName"> & { scientificName?: string | null; localName?: string | null }; successRedirect?: string; onSaved?: () => void | Promise<void>; framed?: boolean; requireImage?: boolean; showImageUrlField?: boolean };
type Slot = GalleryImage & { file?: File };
export function VarietyForm({ initial, successRedirect, onSaved, framed = true }: Props) {
  const router = useRouter(), formRef = useRef<HTMLFormElement>(null);
  const [slots, setSlots] = useState<Slot[]>(initial?.images?.length ? initial.images : initial?.imageUrl ? [{ id: "legacy", url: initial.imageUrl, position: 0, ready: false }] : []);
  const [loading, setLoading] = useState(Boolean(initial?.id)), [loadError, setLoadError] = useState(false);
  const [changed, setChanged] = useState(false), [pending, setPending] = useState(false), [confirmOpen, setConfirmOpen] = useState(false), [progress, setProgress] = useState("");
  const staged = useRef(new Set<string>()), objectUrls = useRef(new Set<string>());
  const alive = useRef(true);
  useEffect(() => {
    if (!initial?.id) return;
    let cancelled = false;
    fetch(`/api/varieties/${initial.id}`, { cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new Error("Unable to load references");
      const data = await r.json();
      if (!cancelled) setSlots(data.images?.length ? data.images : data.imageUrl ? [{ id: "legacy", url: data.imageUrl, position: 0, ready: false }] : []);
    }).catch(() => { if (!cancelled) { setLoadError(true); toast.error("Unable to load references. Close this form and retry."); } }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initial?.id]);
  useEffect(() => {
    const uploads = staged.current, urls = objectUrls.current;
    alive.current = true;
    return () => { alive.current = false; urls.forEach((url) => URL.revokeObjectURL(url)); uploads.forEach((id) => { void fetch(`/api/variety-images/${id}`, { method: "DELETE", keepalive: true }).catch(() => {}); }); };
  }, []);
  function addFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = "";
    if (slots.length + files.length > 5) { toast.error("A reference set has exactly five images. Remove a photo before adding another."); return; }
    for (const file of files) { const error = imageValidationError(file); if (error) { toast.error(error); return; } }
    setSlots([...slots, ...files.map((file, i) => { const url = URL.createObjectURL(file); objectUrls.current.add(url); return { id: crypto.randomUUID(), url, file, position: slots.length + i, ready: false }; })]);
    setChanged(true);
  }
  function removeImage(slot: Slot) {
    if (staged.current.has(slot.id)) void fetch(`/api/variety-images/${slot.id}`, { method: "DELETE" }).then((r) => { if (r.ok) staged.current.delete(slot.id); else toast.warning("Unused upload cleanup is pending; retry when available."); }).catch(() => {});
    setSlots(slots.filter((image) => image.id !== slot.id)); setChanged(true);
  }
  function confirm(event: React.FormEvent) {
    event.preventDefault();
    if ((!initial?.id || changed) && slots.length !== 5) { toast.error("Add exactly five different reference images before saving."); return; }
    setConfirmOpen(true);
  }
  async function save() {
    if (!formRef.current || pending) return;
    setPending(true);
    try {
      const payload: Record<string, unknown> = Object.fromEntries(new FormData(formRef.current).entries());
      if (!initial?.id || changed) {
        if (slots.length !== 5) throw new Error("Exactly five reference images are required.");
        const ready = [...slots];
        for (let i = 0; i < ready.length; i++) {
          if (!alive.current) throw new Error("Form closed");
          const slot = ready[i]; setProgress(`Preparing reference ${i + 1} of 5. First model download can take a few minutes...`);
          if (slot.file) {
            const optimized = await optimizeImageFile(slot.file);
            const embedding = await extractImageEmbedding(optimized), analysis = await analyzeImageFile(optimized);
            const body = new FormData(); body.set("image", optimized); body.set("embedding", JSON.stringify(embedding)); body.set("features", analysis.features);
            const response = await fetch("/api/variety-images", { method: "POST", body }); const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.message || "Unable to upload reference image");
            if (!alive.current) { void fetch(`/api/variety-images/${data.id}`, { method: "DELETE", keepalive: true }).catch(() => {}); throw new Error("Form closed"); }
            staged.current.add(data.id); ready[i] = data;
          } else if (!slot.ready) {
            ready[i] = await prepareStoredReference({ kind: "variety", varietyId: initial!.id, imageId: slot.id === "legacy" ? undefined : slot.id, url: slot.url });
          }
          setSlots([...ready]);
        }
        payload.imageIds = ready.map((slot) => slot.id);
      }
      setProgress("Saving variety...");
      if (!alive.current) throw new Error("Form closed");
      const response = await fetch(initial?.id ? `/api/varieties/${initial.id}` : "/api/varieties", { method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to save variety");
      staged.current.clear(); setChanged(false); setConfirmOpen(false);
      if (data.cleanupPending) toast.warning("Variety saved. Some replaced images are pending storage cleanup.");
      else toast.success(initial?.id ? "Variety updated" : "Variety created");
      if (onSaved) { await onSaved(); return; }
      router.push(successRedirect ?? "/admin/varieties"); router.refresh();
    } catch (error) { if (alive.current) toast.error(error instanceof Error ? error.message : "Unable to save variety. Please retry."); }
    finally { if (alive.current) { setPending(false); setProgress(""); } }
  }
  const form = <form ref={formRef} className="grid gap-5 lg:grid-cols-[1fr_340px]" onSubmit={confirm}>
    <fieldset disabled={pending} className="grid min-w-0 gap-4 md:grid-cols-2">
      <Field name="name" label="Variety name" value={initial?.name} required />
      <Field name="scientificName" label="Scientific name" value={initial?.scientificName} />
      <Field name="localName" label="Local name" value={initial?.localName} />
      <Field name="treeHeight" label="Tree height" value={initial?.treeHeight} required />
      <Field name="fruitColor" label="Fruit color" value={initial?.fruitColor} required />
      <Field name="averageYield" label="Average yield" value={initial?.averageYield} required />
      <Field name="locationFound" label="Location/barangay in Cajidiocan" value={initial?.locationFound} required />
      <div className="space-y-2 md:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" required defaultValue={initial?.description} /></div>
      <div className="space-y-2 md:col-span-2"><Label htmlFor="characteristics">Characteristics</Label><Textarea id="characteristics" name="characteristics" required defaultValue={initial?.characteristics} /></div>
    </fieldset>
    <div className="min-w-0 space-y-4">
      <div><p className="font-semibold">Reference images: {slots.length}/5</p><p className="text-sm text-muted-foreground">Use five different photos with varied angles and lighting. The first photo is the cover.</p></div>
      {initial?.id && slots.length < 5 ? <p className="text-sm text-muted-foreground">Existing record: details can be saved now. Changing the image set requires five images.</p> : null}
      <div className="grid grid-cols-2 gap-2">{slots.map((slot, i) => <div key={slot.id} className="overflow-hidden rounded-lg border">
        <Image src={slot.url} alt={`Reference ${i + 1}`} width={320} height={240} className="h-28 w-full object-cover" unoptimized />
        <div className="flex flex-wrap gap-1 p-1"><Button type="button" size="sm" variant="ghost" disabled={pending || loading} aria-label={`Use reference ${i + 1} as cover`} onClick={() => { setSlots([slot, ...slots.filter((s) => s.id !== slot.id)]); setChanged(true); }}><Star className="h-3 w-3" />{i === 0 ? "Cover" : "Cover?"}</Button><Button type="button" size="sm" variant="ghost" aria-label={`Remove reference ${i + 1}`} disabled={pending || loading} onClick={() => removeImage(slot)}><X className="h-3 w-3" /></Button></div>
      </div>)}</div>
      <Label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm"><Upload className="h-4 w-4" /> Add reference photos<Input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={pending || loading || loadError || slots.length >= 5} onChange={addFiles} /></Label>
      <p role="status" className="text-sm text-muted-foreground">{loading ? "Loading saved images..." : progress}</p>
      <Button type="submit" className="w-full" disabled={pending || loading || loadError}><Save className="h-4 w-4" />{pending ? "Saving..." : "Save variety"}</Button>
    </div>
  </form>;
  return <>{framed ? <Card><CardHeader><CardTitle>{initial?.id ? "Edit coconut variety" : "Add coconut variety"}</CardTitle></CardHeader><CardContent>{form}</CardContent></Card> : form}
    <Dialog open={confirmOpen} onOpenChange={(open) => { if (!pending) setConfirmOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Confirm variety {initial?.id ? "update" : "creation"}</DialogTitle><DialogDescription>Save the details and reference images? Photos improve comparison coverage but do not train the model automatically.</DialogDescription></DialogHeader><p role="status" className="text-sm">{progress}</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => setConfirmOpen(false)}>Cancel</Button><Button type="button" disabled={pending} onClick={save}>{pending ? "Saving..." : "Confirm Save"}</Button></div></DialogContent></Dialog>
  </>;
}
function Field({ name, label, value, required }: { name: keyof VarietyInput; label: string; value?: string | null; required?: boolean }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} defaultValue={value ?? ""} required={required} /></div>; }
