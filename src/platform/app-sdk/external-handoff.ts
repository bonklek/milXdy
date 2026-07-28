export type ExternalHandoffAdapter = "remilia-maker";

export type ExternalHandoffTarget = "milady" | "remilio" | "bonkler" | "kagami";
export type ExternalHandoffMode = "captioned" | "randomMeme";

export type ExternalHandoffRequest = {
  appId: string;
  handoffId: string;
  adapter: ExternalHandoffAdapter;
  target: ExternalHandoffTarget;
  mode: ExternalHandoffMode;
  topText: string;
  bottomText: string;
};

export type SplitExternalHandoffText = {
  topText: string;
  bottomText: string;
};

export const REMILIA_MAKER_HANDOFF_ORIGIN = "https://maker.remilia.org";
export const REMILIA_MAKER_HANDOFF_HOST = "https://maker.remilia.org/*";
export const MAX_EXTERNAL_HANDOFF_TEXT_LENGTH = 10_000;

const remiliaMakerTargets = new Set<ExternalHandoffTarget>(["milady", "remilio", "bonkler", "kagami"]);

export function isExternalHandoffAdapter(value: unknown): value is ExternalHandoffAdapter {
  return value === "remilia-maker";
}

export function isExternalHandoffTarget(value: unknown): value is ExternalHandoffTarget {
  return typeof value === "string" && remiliaMakerTargets.has(value as ExternalHandoffTarget);
}

export function externalHandoffUrl(adapter: ExternalHandoffAdapter, target: ExternalHandoffTarget): URL | null {
  if (adapter !== "remilia-maker" || !isExternalHandoffTarget(target)) return null;
  return new URL(`/${target}`, REMILIA_MAKER_HANDOFF_ORIGIN);
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
