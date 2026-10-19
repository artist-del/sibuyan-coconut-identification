"use client";
import { useState } from "react";
import Image from "next/image";
export function ReferenceGallery({ images, cover, name, height = "h-52" }: { images?: { id: string; url: string }[]; cover?: string | null; name: string; height?: string }) {
  const urls = images?.length ? images.map((image) => image.url) : cover ? [cover] : [];
  const [selected, setSelected] = useState(0);
  return <div><div className={`relative bg-muted ${height}`}>{urls.length ? <Image src={urls[selected] ?? urls[0]} alt={`${name} reference ${selected + 1}`} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-contain" /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">No image</div>}</div>{urls.length > 1 ? <div className="flex gap-1 overflow-x-auto p-2">{urls.map((url, i) => <button key={`${url}-${i}`} type="button" aria-label={`View ${name} reference ${i + 1}`} aria-pressed={selected === i} className={`relative h-12 w-12 shrink-0 overflow-hidden rounded border-2 ${selected === i ? "border-primary" : "border-transparent"}`} onClick={() => setSelected(i)}><Image src={url} alt="" fill sizes="48px" className="object-cover" /></button>)}</div> : null}</div>;
}
