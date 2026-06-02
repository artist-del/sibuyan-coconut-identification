import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Database } from "lucide-react";

import { Button } from "@/components/ui/button";

const slides = [
  "https://images.unsplash.com/photo-1571146234680-6cd0c35e07c7?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1537191072641-5e19cc173c6a?auto=format&fit=crop&w=1800&q=80",
  "https://images.unsplash.com/photo-1553603043-55e1e23fb5be?auto=format&fit=crop&w=1800&q=80"
];

export function Hero() {
  return (
    <section className="relative min-h-[92vh] overflow-hidden">
      <div className="absolute inset-0">
        {slides.map((src, index) => (
          <Image
            key={src}
            src={src}
            alt="Coconut farms and Cajidiocan landscape"
            fill
            priority={index === 0}
            className="hero-slide object-cover opacity-0"
            sizes="100vw"
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl items-center px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <div className="max-w-3xl text-white">
          <p className="mb-4 inline-flex rounded-md border border-white/30 bg-white/10 px-3 py-1 text-sm backdrop-blur animate-fade-up">
            Coconut variety records for Cajidiocan, Romblon
          </p>
          <h1 className="text-4xl font-bold tracking-normal sm:text-6xl lg:text-7xl animate-fade-up">
            Cajidiocan Coconut Identification System
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-white/85 sm:text-lg animate-fade-up">
            A responsive municipal agriculture platform for cataloging Cajidiocan coconut varieties, supporting field uploads,
            and preparing image-based identification workflows.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row animate-fade-up">
            <Button asChild size="lg">
              <Link href="/identify">Identify Coconut Variety <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/records">View Coconut Records <Database className="h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
