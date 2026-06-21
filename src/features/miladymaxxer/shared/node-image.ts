import sharp from "sharp";

import {
  CLASSIFIER_MODEL_CHANNELS,
  CLASSIFIER_MODEL_INPUT_SIZE,
  CLASSIFIER_MODEL_MEAN,
  CLASSIFIER_MODEL_STD,
} from "./constants";
import type { RuntimeImageFeatures } from "./runtime-image-types";

export type CropVariant = "center" | "top";

export async function computeNodeImageFeatures(
  buffer: Buffer,
  variant: CropVariant = "center",
): Promise<RuntimeImageFeatures> {
  const position = variant === "top" ? "north" : "centre";
  const classifierRaw = await sharp(buffer)
    .resize(CLASSIFIER_MODEL_INPUT_SIZE, CLASSIFIER_MODEL_INPUT_SIZE, {
      fit: "cover",
      position,
      kernel: "lanczos3",
    })
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .raw()
    .toBuffer();

  return {
    modelTensor: computeClassifierTensor(classifierRaw),
    modelShape: [1, CLASSIFIER_MODEL_CHANNELS, CLASSIFIER_MODEL_INPUT_SIZE, CLASSIFIER_MODEL_INPUT_SIZE],
  };
}

function computeClassifierTensor(buffer: Buffer): number[] {
  const pixelCount = CLASSIFIER_MODEL_INPUT_SIZE * CLASSIFIER_MODEL_INPUT_SIZE;
  const tensor = new Array<number>(CLASSIFIER_MODEL_CHANNELS * pixelCount);
  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * 3;
    tensor[pixelIndex] = (buffer[offset] / 255 - CLASSIFIER_MODEL_MEAN[0]) / CLASSIFIER_MODEL_STD[0];
    tensor[pixelCount + pixelIndex] =
      (buffer[offset + 1] / 255 - CLASSIFIER_MODEL_MEAN[1]) / CLASSIFIER_MODEL_STD[1];
    tensor[pixelCount * 2 + pixelIndex] =
      (buffer[offset + 2] / 255 - CLASSIFIER_MODEL_MEAN[2]) / CLASSIFIER_MODEL_STD[2];
  }
  return tensor;
}
