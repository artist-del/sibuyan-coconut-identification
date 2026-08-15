import jsPDF from "jspdf";
import { stringify } from "csv-stringify/sync";

export type ExportVariety = {
  name: string;
  localName: string | null;
  locationFound: string;
  fruitColor: string;
  averageYield: string;
  imageUrl: string | null;
};

export function varietiesToCsv(varieties: ExportVariety[]) {
  return stringify(varieties, {
    header: true,
    columns: ["name", "localName", "locationFound", "fruitColor", "averageYield", "imageUrl"]
  });
}

export async function varietiesToPdf(varieties: ExportVariety[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Cajidiocan Coconut Variety Records", 14, 18);

  let y = 30;
  for (const [index, variety] of varieties.entries()) {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(12);
    doc.text(`${index + 1}. ${variety.name}`, 14, y);
    doc.setFontSize(9);
    doc.text(`Local name: ${variety.localName || "-"}`, 14, y + 6);
    doc.text(`Location: ${variety.locationFound}`, 14, y + 11);
    doc.text(`Fruit: ${variety.fruitColor}`, 14, y + 16);
    doc.text(`Yield: ${variety.averageYield}`, 14, y + 21);

    if (variety.imageUrl) {
      const image = await fetchImageDataUrl(variety.imageUrl);
      if (image) {
        doc.addImage(image.dataUrl, image.format, 148, y - 4, 42, 32);
      } else {
        doc.text("Image: unable to embed", 148, y + 6);
        doc.text(variety.imageUrl, 148, y + 11, { maxWidth: 48 });
      }
    } else {
      doc.text("Image: none", 148, y + 6);
    }

    y += 42;
  }

  return doc.output("arraybuffer");
}

async function fetchImageDataUrl(imageUrl: string) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    const format = getImageFormat(contentType, imageUrl);
    if (!format) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      dataUrl: `data:${contentType};base64,${buffer.toString("base64")}`,
      format
    };
  } catch {
    return null;
  }
}

function getImageFormat(contentType: string, imageUrl: string) {
  const lowerUrl = imageUrl.toLowerCase();
  if (contentType.includes("png") || lowerUrl.endsWith(".png")) return "PNG";
  if (contentType.includes("jpeg") || contentType.includes("jpg") || lowerUrl.endsWith(".jpg") || lowerUrl.endsWith(".jpeg")) return "JPEG";
  if (contentType.includes("webp") || lowerUrl.endsWith(".webp")) return "WEBP";
  return null;
}
