"use client";

import { ANALYSIS_VERSION, SCREENING_MODEL, screeningLabels, createImageScreener } from "@/lib/screening";
import { normalizeEmbedding } from "@/lib/image-embedding";

export type ImageAnalysis = {
  labels: string;
  features: string;
  steps: string[];
};


// Loaded only on an identification request. No image is sent to a model API.
type ClipRuntime = {
  processor: (image: unknown) => Promise<Record<string, unknown>>;
  tokenizer: (text: string[], options: { padding: boolean; truncation: boolean }) => Record<string, unknown>;
  model: (inputs: Record<string, unknown>) => Promise<{ image_embeds: { data: ArrayLike<number> }; logits_per_image: { data: ArrayLike<number> } }>;
};
let clipPromise: Promise<{ clip: ClipRuntime; fromCanvas: (canvas: HTMLCanvasElement) => unknown }> | null = null;
async function loadClip() {
  if (clipPromise) return clipPromise;
  clipPromise = (async () => {
  const { pipeline, env, RawImage } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  const load = pipeline as unknown as (task: "zero-shot-image-classification", model: string, options: { dtype: "q8"; device: "wasm" }) => Promise<import("@huggingface/transformers").ZeroShotImageClassificationPipeline>;
  const clip = await load("zero-shot-image-classification", SCREENING_MODEL, { dtype: "q8", device: "wasm" });
  return { clip: clip as unknown as ClipRuntime, fromCanvas: (canvas: HTMLCanvasElement) => RawImage.fromCanvas(canvas) };
  })().catch((error) => { clipPromise = null; throw error; });
  return clipPromise;
}
export const screenImageFile = createImageScreener(async () => {
  const { clip, fromCanvas } = await loadClip();
  return async (file: File) => {
    const image = await loadImageFromFile(file);
    const canvas = preprocessImage(image);
    if (!canvas) throw new Error("Image decoding unavailable");
    const pixels = await clip.processor(fromCanvas(canvas));
    const text = clip.tokenizer(screeningLabels.map((label) => `This is a photo of ${label}.`), { padding: true, truncation: true });
    const output = await clip.model({ ...text, ...pixels });
    const logits = Array.from(output.logits_per_image.data), maximum = Math.max(...logits);
    const weights = logits.map((value) => Math.exp(value - maximum)), total = weights.reduce((a, b) => a + b, 0);
    return { model: SCREENING_MODEL, version: ANALYSIS_VERSION, embedding: normalizeEmbedding(output.image_embeds.data), scores: screeningLabels.map((label, i) => ({ label, score: weights[i] / total })) };
  };
});

export async function extractImageEmbedding(file: File) {
  const result = await screenImageFile(file, () => {});
  if (!result.embedding) throw new Error("Image embedding unavailable. Retry processing this image.");
  return result.embedding;
}

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

  const imageFeatures = extractImageFeatures(processedCanvas);

  const featureList = imageFeatures.split(" ").filter(Boolean);

  return {
    labels: "",
    features: imageFeatures,
    steps: [
      "Input coconut image",
      "Image pre-processing: resize while preserving aspect ratio and original colors",
      `Feature extraction: ${featureList.length ? featureList.join(", ") : "no strong visual features"}`,
      "Classification: compare extracted image features with coconut records",
      "Output: ranked coconut variety matches"
    ]
  };
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
  const scale = size / Math.max(imageElement.naturalWidth, imageElement.naturalHeight);
  const width = Math.max(1, Math.round(imageElement.naturalWidth * scale));
  const height = Math.max(1, Math.round(imageElement.naturalHeight * scale));
  canvas.width = width;
  canvas.height = height;
  context.drawImage(imageElement, 0, 0, width, height);

  return canvas;
}

export function extractImageFeatures(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return "";

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  // A uniform/blank image carries no usable visual evidence.
  let min = 255, max = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const brightness = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
    min = Math.min(min, brightness); max = Math.max(max, brightness);
  }
  if (max - min < 8) return "";
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
    orange: 0,
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
    const orange = red > 140 && green > 65 && red > green * 1.15 && red < green * 2.5 && blue < green * 0.8;
    if (orange) counts.orange += 1;
    if (!orange && red > 120 && green > 100 && blue < 100 && Math.abs(red - green) < 90) counts.yellow += 1;
    if (!orange && red > 75 && green > 45 && green < 135 && blue < 95 && red > blue * 1.2) counts.brown += 1;
  }

  return Object.entries(counts)
    .sort(([, first], [, second]) => second - first)
    .filter(([, count]) => count > canvasPixelThreshold(imageData))
    .slice(0, 2)
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
  const features: string[] = [];

  if (coverage > 0.18) features.push("large fruit");
  if (aspectRatio > 0.72 && aspectRatio < 1.35) features.push("round oval");
  if (aspectRatio >= 1.35 || aspectRatio <= 0.72) features.push("elongated");

  return features;
}

function canvasPixelThreshold(imageData: ImageData) {
  return imageData.width * imageData.height * 0.15;
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
