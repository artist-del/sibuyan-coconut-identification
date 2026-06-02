import jsPDF from "jspdf";
import { stringify } from "csv-stringify/sync";

export type ExportVariety = {
  name: string;
  localName: string | null;
  locationFound: string;
  fruitColor: string;
  averageYield: string;
};

export function varietiesToCsv(varieties: ExportVariety[]) {
  return stringify(varieties, {
    header: true,
    columns: ["name", "localName", "locationFound", "fruitColor", "averageYield"]
  });
}

export function varietiesToPdf(varieties: ExportVariety[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Cajidiocan Coconut Variety Records", 14, 18);
  doc.setFontSize(10);

  varieties.forEach((variety, index) => {
    const y = 32 + index * 12;
    doc.text(`${index + 1}. ${variety.name} - ${variety.locationFound}`, 14, y);
    doc.text(`Fruit: ${variety.fruitColor} | Yield: ${variety.averageYield}`, 18, y + 5);
  });

  return doc.output("arraybuffer");
}
