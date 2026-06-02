"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ExportButtons() {
  async function download(format: "csv" | "pdf") {
    const response = await fetch(`/api/export?format=${format}`);
    if (!response.ok) {
      toast.error("Export failed");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cajidiocan-coconut-records.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => download("csv")}><Download className="h-4 w-4" /> CSV</Button>
      <Button variant="outline" onClick={() => download("pdf")}><Download className="h-4 w-4" /> PDF</Button>
    </div>
  );
}
