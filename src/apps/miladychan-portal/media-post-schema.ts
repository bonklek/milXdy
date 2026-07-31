export const MEDIA_POST_MARKER = "[milxdy:media/v1]";

export const MEDIA_KINDS = ["music", "book", "podcast", "screen", "recipe"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export type PublicPostProvenance = {
  board: string;
  postId: number;
  postedAt: number;
  authorLabel: string;
  nativeUrl: string;
};

export type TaggedMediaPost = {
  kind: MediaKind;
  identifier: string;
  title: string;
  creator: string | null;
  sourceUrl: string | null;
  comment: string | null;
  selfDeclaredIdentity: string | null;
  provenance: PublicPostProvenance;
};

// Intentionally empty until an upstream board is approved for identifier-media discovery.
// Apps must never silently broaden this into a scan of every public board.
export const DEFAULT_MEDIA_DISCOVERY_BOARDS: readonly string[] = [];

export const IDENTITY_PROVENANCE_POLICY = {
  publicPost: "A native post's visible author label and URL are public-post provenance only.",
  selfDeclared: "An optional visible identity field is self-declared and is never treated as verified.",
  verified: "No verified cross-network identity provenance is available in v1.",
  remiNetFriends: "Unavailable until a documented, consented RemiNet friends contract is approved.",
} as const;

const FIELD_NAMES = new Set(["kind", "id", "title", "creator", "source", "comment", "identity"]);

export function parseTaggedMediaPost(body: string, provenance: PublicPostProvenance): TaggedMediaPost | null {
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  const markerIndex = lines.findIndex((line) => line.trim() !== "");
  if (markerIndex < 0 || lines[markerIndex].trim() !== MEDIA_POST_MARKER) return null;
  const fields = new Map<string, string>();
  let activeField = "";
  for (const line of lines.slice(markerIndex + 1)) {
    const field = /^([a-z]+):\s*(.*)$/u.exec(line);
    if (field) {
      const name = field[1];
      if (!FIELD_NAMES.has(name) || fields.has(name)) return null;
      fields.set(name, field[2].trim());
      activeField = name;
      continue;
    }
    if (!line.trim()) continue;
    if (activeField !== "comment") return null;
    fields.set("comment", `${fields.get("comment") || ""}\n${line}`.trim());
  }
  const kind = fields.get("kind");
  const identifier = fields.get("id");
  const title = fields.get("title");
  if (!isMediaKind(kind) || !identifier || !title || !isIdentifierForKind(kind, identifier)) return null;
  const sourceUrl = normalizeHttpUrl(fields.get("source"));
  const identity = normalizeHttpUrl(fields.get("identity"));
  if ((fields.has("source") && !sourceUrl) || (fields.has("identity") && !identity)) return null;
  return {
    kind,
    identifier: normalizeIdentifier(kind, identifier),
    title: title.slice(0, 240),
    creator: optionalField(fields.get("creator"), 240),
    sourceUrl,
    comment: optionalField(fields.get("comment"), 2_000),
    selfDeclaredIdentity: identity,
    provenance,
  };
}

export function normalizeMediaBoardAllowlist(boards: readonly string[]): string[] {
  return [...new Set(boards.map((board) => board.trim().toLowerCase()).filter((board) => /^[a-z0-9]{1,32}$/u.test(board)))];
}

function isMediaKind(value: string | undefined): value is MediaKind {
  return typeof value === "string" && (MEDIA_KINDS as readonly string[]).includes(value);
}

function isIdentifierForKind(kind: MediaKind, identifier: string): boolean {
  const normalized = identifier.trim();
  if (kind === "music") return /^isrc:[a-z]{2}[a-z0-9]{3}\d{7}$/iu.test(normalized);
  if (kind === "book") return /^isbn:(?:\d[-\s]?){10,13}[\dx]$/iu.test(normalized);
  if (kind === "podcast" || kind === "recipe") return normalizeHttpUrl(normalized.replace(/^feed:/iu, "")) !== null;
  return /^(?:imdb:tt\d{7,8}|tmdb:(?:movie|tv):\d+)$/iu.test(normalized);
}

function normalizeIdentifier(kind: MediaKind, identifier: string): string {
  const value = identifier.trim();
  if (kind === "music" || kind === "book" || kind === "screen") return value.toLowerCase();
  return value.replace(/^feed:/iu, "");
}

function normalizeHttpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function optionalField(value: string | undefined, maxLength: number): string | null {
  const clean = value?.trim() || "";
  return clean ? clean.slice(0, maxLength) : null;
}
