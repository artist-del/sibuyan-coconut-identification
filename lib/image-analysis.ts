"use client";

import * as mobilenet from "@tensorflow-models/mobilenet";
import "@tensorflow/tfjs";

export type ImageAnalysis = {
  labels: string;
  features: string;
  steps: string[];
};

let modelPromise: Promise<mobilenet.MobileNet> | null = null;

export async function analyzeImageFile(file: File): Promise<ImageAnalysis> {
  const image = await loadImageFromFile(file);
  return analyzeImageElement(image);
}

export async function optimizeImageFile(file: File, maxSize = 1280, quality = 0.82) {
  if (!file.type.startsWith("image/")) return file;

  const image = await loadImageFromFile(file);
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  if (scale >= 1 && file.size < 900_000) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

  const context = canvas.getContext("2d");
  if (!context) return file;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" });
}

export async function analyzeImageElement(imageElement: HTMLImageElement): Promise<ImageAnalysis> {
  const processedCanvas = preprocessImage(imageElement);
  if (!processedCanvas) return { labels: "", features: "", steps: [] };

  const [labelText, imageFeatures] = await Promise.all([
    classifyImage(processedCanvas),
    Promise.resolve(extractImageFeatures(processedCanvas))
  ]);

  const featureList = imageFeatures.split(" ").filter(Boolean);

  return {
    labels: labelText,
    features: imageFeatures,
    steps: [
      "Input coconut image",
      "Image pre-processing: resize, noise removal, image enhancement",
      `Feature extraction: ${featureList.length ? featureList.join(", ") : "no strong visual features"}`,
      "Classification: compare extracted image features with coconut records",
      "Output: ranked coconut variety matches"
    ]
  };
}

function getModel() {
  modelPromise ??= mobilenet.load({ version: 1, alpha: 0.25 });
  return modelPromise;
}

async function classifyImage(canvas: HTMLCanvasElement) {
  const model = await getModel();
  const predictions = await model.classify(canvas);
  return predictions
    .filter((prediction) => prediction.probability >= 0.05)
    .map((prediction) => prediction.className.toLowerCase())
    .join(" ");
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to load image for analysis"));
    };
    image.src = url;
  });
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

  return canvas;
}

function extractImageFeatures(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return "";

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const colorFeatures = extractColorFeatures(imageData);
  const shapeFeatures = extractShapeFeatures(imageData);
  const textureFeatures = extractTextureFeatures(imageData);
  return [...colorFeatures, ...shapeFeatures, ...textureFeatures].join(" ");
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
    .map(([feature]) => `${feature} color`);
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
