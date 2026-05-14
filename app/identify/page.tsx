import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { IdentifyForm } from "@/components/forms/identify-form";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/landing/site-header";

export default function IdentifyPage() {
  return (
    <main className="min-h-screen bg-secondary/20">
      <SiteHeader />
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/"><ArrowLeft className="h-4 w-4" /> Back home</Link>
        </Button>
        <div className="mb-8 max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-normal">Identify a Coconut Variety</h1>
          <p className="mt-3 text-muted-foreground">
            Upload a field image and add observations to compare it against actual Sibuyan coconut variety records.
          </p>
        </div>
        <IdentifyForm />
      </section>
    </main>
  );
}
