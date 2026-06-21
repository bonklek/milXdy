import * as ort from "onnxruntime-web";

import type { WorkerRequest, WorkerResponse } from "./shared/types";

interface InitMessage {
  modelUrl: string;
  wasmPath: string;
  positiveIndex?: number;
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let positiveIndex = 1;
let runQueue: Promise<void> = Promise.resolve();

self.addEventListener("message", (event: MessageEvent<InitMessage | WorkerRequest>) => {
  const data = event.data;

  if ("modelUrl" in data) {
    ort.env.wasm.wasmPaths = data.wasmPath;
    positiveIndex = typeof data.positiveIndex === "number" ? data.positiveIndex : 1;
    sessionPromise = ort.InferenceSession.create(data.modelUrl, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
    });
    runQueue = Promise.resolve();
    return;
  }

  runQueue = runQueue
    .then(() => handleInferenceRequest(data))
    .catch((error: unknown) => {
      const response: WorkerResponse = {
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
      };
      self.postMessage(response);
    });
});

async function handleInferenceRequest(data: WorkerRequest): Promise<void> {
  if (!sessionPromise) {
    throw new Error("Worker used before model initialization");
  }

  const session = await sessionPromise;
  const tensor = new ort.Tensor("float32", Float32Array.from(data.tensor), data.shape);
  const outputName = session.outputNames[0];
  const result = await session.run({
    input: tensor,
  });
  const output = Array.from(result[outputName].data as Iterable<number>);
  const score = output.length === 1 ? Number(output[0]) : Number(output[positiveIndex] ?? output[0]);

  const response: WorkerResponse = {
    id: data.id,
    score,
  };

  self.postMessage(response);
}
