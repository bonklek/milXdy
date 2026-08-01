export type ExternalHandoffAdapter = "remilia-maker" | "cheeseworld";

export type ExternalHandoffTarget = "milady" | "remilio" | "bonkler" | "kagami" | "deepfry";
export type ExternalHandoffMode = "captioned" | "randomMeme";

export type ExternalHandoffRequest = {
  appId: string;
  handoffId: string;
  adapter: ExternalHandoffAdapter;
  target: ExternalHandoffTarget;
  mode: ExternalHandoffMode;
  topText: string;
  bottomText: string;
  imageDataUrl?: string;
};

export type SplitExternalHandoffText = {
  topText: string;
  bottomText: string;
};

export const REMILIA_MAKER_HANDOFF_ORIGIN = "https://maker.remilia.org";
export const REMILIA_MAKER_HANDOFF_HOST = "https://maker.remilia.org/*";
export const CHEESEWORLD_HANDOFF_ORIGIN = "https://cult.inc";
export const CHEESEWORLD_HANDOFF_HOST = "https://cult.inc/*";
export const MAX_EXTERNAL_HANDOFF_IMAGE_BYTES = 10 * 1024 * 1024;
export const EXTERNAL_HANDOFF_RENDER_TIMEOUT_MS = 45_000;
export const EXTERNAL_HANDOFF_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;
export const MAX_EXTERNAL_HANDOFF_TEXT_LENGTH = 10_000;

const remiliaMakerTargets = new Set<ExternalHandoffTarget>(["milady", "remilio", "bonkler", "kagami"]);
const externalHandoffTargets = new Set<ExternalHandoffTarget>([...remiliaMakerTargets, "deepfry"]);

export function isExternalHandoffAdapter(value: unknown): value is ExternalHandoffAdapter {
  return value === "remilia-maker" || value === "cheeseworld";
}

export function isExternalHandoffTarget(value: unknown): value is ExternalHandoffTarget {
  return typeof value === "string" && externalHandoffTargets.has(value as ExternalHandoffTarget);
}

export function externalHandoffUrl(adapter: ExternalHandoffAdapter, target: ExternalHandoffTarget): URL | null {
  if (adapter === "remilia-maker" && remiliaMakerTargets.has(target)) return new URL(`/${target}`, REMILIA_MAKER_HANDOFF_ORIGIN);
  if (adapter === "cheeseworld" && target === "deepfry") return new URL("/cheeseworld", CHEESEWORLD_HANDOFF_ORIGIN);
  return null;
}

export function validateExternalHandoffImageDataUrl(value: unknown, maxBytes = MAX_EXTERNAL_HANDOFF_IMAGE_BYTES): {
  dataUrl: string;
  contentType: typeof EXTERNAL_HANDOFF_IMAGE_MIME_TYPES[number];
  byteLength: number;
} | null {
  if (typeof value !== "string" || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_EXTERNAL_HANDOFF_IMAGE_BYTES) return null;
  const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/u.exec(value);
  if (!match || !EXTERNAL_HANDOFF_IMAGE_MIME_TYPES.includes(match[1] as typeof EXTERNAL_HANDOFF_IMAGE_MIME_TYPES[number])) return null;
  const padding = match[2].endsWith("==") ? 2 : match[2].endsWith("=") ? 1 : 0;
  const byteLength = Math.floor(match[2].length * 3 / 4) - padding;
  return byteLength >= 1 && byteLength <= maxBytes
    ? { dataUrl: value, contentType: match[1] as typeof EXTERNAL_HANDOFF_IMAGE_MIME_TYPES[number], byteLength }
    : null;
}

export async function withExternalHandoffTimeout<T>(task: Promise<T>, timeoutMs = EXTERNAL_HANDOFF_RENDER_TIMEOUT_MS): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error("The maker timeout is invalid.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("The maker did not finish in time.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Accept literal user-entered fields without rewriting their text. */
export function validateExternalHandoffCaptions(
  captions: unknown,
  maxLength = MAX_EXTERNAL_HANDOFF_TEXT_LENGTH,
): SplitExternalHandoffText | null {
  if (!captions || typeof captions !== "object") return null;
  const { topText, bottomText } = captions as Record<string, unknown>;
  if (typeof topText !== "string" || typeof bottomText !== "string") return null;
  if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > MAX_EXTERNAL_HANDOFF_TEXT_LENGTH) return null;
  if (topText.length > maxLength || bottomText.length > maxLength) return null;
  return { topText, bottomText };
}

/**
 * Splits only on author-provided line boundaries. One newline is naturally the
 * split; with several, select the boundary nearest the text midpoint so meme
 * captions remain balanced. No text is changed other than normalizing CRLF
 * and trimming the two fields the remote maker receives.
 */
export function splitExternalHandoffText(value: string): SplitExternalHandoffText | null {
  const text = value.replace(/\r\n?/gu, "\n");
  if (text.length === 0 || text.length > MAX_EXTERNAL_HANDOFF_TEXT_LENGTH) return null;
  const boundaries = Array.from(text.matchAll(/\n+/gu), (match) => match.index ?? 0);
  if (boundaries.length === 0) return { topText: text.trim(), bottomText: "" };
  const midpoint = text.length / 2;
  const splitAt = boundaries.reduce((best, candidate) => {
    return Math.abs(candidate - midpoint) < Math.abs(best - midpoint) ? candidate : best;
  });
  const newlineLength = text.slice(splitAt).match(/^\n+/u)?.[0].length ?? 1;
  return {
    topText: text.slice(0, splitAt).trim(),
    bottomText: text.slice(splitAt + newlineLength).trim(),
  };
}
