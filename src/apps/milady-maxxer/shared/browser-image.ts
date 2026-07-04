import type { RuntimeImageFeatures } from "./runtime-image-types";
import {
  CLASSIFIER_MODEL_CHANNELS,
  CLASSIFIER_MODEL_INPUT_SIZE,
  CLASSIFIER_MODEL_MEAN,
  CLASSIFIER_MODEL_STD,
} from "./constants";

export type CropVariant = "center" | "top";

export async function loadCorsImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => reject(new Error(`Avatar image failed to load: ${url}`)), {
      once: true,
    });
  });
  image.src = url;
  await loaded;
  return image;
}

export async function computeBrowserImageFeatures(
  image: HTMLImageElement,
  variant: CropVariant = "center",
): Promise<RuntimeImageFeatures> {
  const classifierCanvas = document.createElement("canvas");
  classifierCanvas.width = CLASSIFIER_MODEL_INPUT_SIZE;
  classifierCanvas.height = CLASSIFIER_MODEL_INPUT_SIZE;
  const classifierContext = classifierCanvas.getContext("2d", { willReadFrequently: true });
  if (!classifierContext) {
    throw new Error("Unable to create classifier context");
  }
  drawCoverImage(classifierContext, image, CLASSIFIER_MODEL_INPUT_SIZE, CLASSIFIER_MODEL_INPUT_SIZE, variant);
  const classifierPixels = classifierContext
    .getImageData(0, 0, CLASSIFIER_MODEL_INPUT_SIZE, CLASSIFIER_MODEL_INPUT_SIZE).data;

  return {
    modelTensor: computeClassifierTensor(classifierPixels),
    modelShape: [1, CLASSIFIER_MODEL_CHANNELS, CLASSIFIER_MODEL_INPUT_SIZE, CLASSIFIER_MODEL_INPUT_SIZE],
  };
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
  variant: CropVariant,
): void {
  const imageWidth = "naturalWidth" in image ? image.naturalWidth : targetWidth;
  const imageHeight = "naturalHeight" in image ? image.naturalHeight : targetHeight;
  const scale = Math.max(targetWidth / imageWidth, targetHeight / imageHeight);
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;
  const offsetX = (targetWidth - scaledWidth) / 2;
  const offsetY = variant === "top" ? 0 : (targetHeight - scaledHeight) / 2;

  context.clearRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
}

function computeClassifierTensor(buffer: Uint8ClampedArray): number[] {
  const pixelCount = CLASSIFIER_MODEL_INPUT_SIZE * CLASSIFIER_MODEL_INPUT_SIZE;
  const tensor = new Array<number>(CLASSIFIER_MODEL_CHANNELS * pixelCount);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    tensor[pixelIndex] = buffer[offset] / 255;
    tensor[pixelCount + pixelIndex] = buffer[offset + 1] / 255;
    tensor[pixelCount * 2 + pixelIndex] = buffer[offset + 2] / 255;
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    tensor[pixelIndex] = (tensor[pixelIndex] - CLASSIFIER_MODEL_MEAN[0]) / CLASSIFIER_MODEL_STD[0];
    tensor[pixelCount + pixelIndex] =
      (tensor[pixelCount + pixelIndex] - CLASSIFIER_MODEL_MEAN[1]) / CLASSIFIER_MODEL_STD[1];
    tensor[pixelCount * 2 + pixelIndex] =
      (tensor[pixelCount * 2 + pixelIndex] - CLASSIFIER_MODEL_MEAN[2]) / CLASSIFIER_MODEL_STD[2];
  }

  return tensor;
}
