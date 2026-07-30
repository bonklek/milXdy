export type RemoteQueryResource = "posts" | "facets";

export type RemoteQueryRequest = {
  resource: RemoteQueryResource;
  cursor?: string;
  limit?: number;
  facets?: string[];
};

export const REMIBOORU_QUERY_HOST = "https://remibooru.com/*";
export const REMIBOORU_QUERY_ORIGIN = "https://remibooru.com";
export const MAX_REMIBOORU_PAGE_SIZE = 24;
export const MAX_REMIBOORU_FACETS = 5;
export const MAX_REMIBOORU_FACET_LENGTH = 80;

export function remibooruQueryUrl(request: RemoteQueryRequest, maxPageSize: number): URL | null {
  if (!Number.isInteger(maxPageSize) || maxPageSize < 1 || maxPageSize > MAX_REMIBOORU_PAGE_SIZE) return null;
  if (request.resource === "facets") {
    if (request.cursor !== undefined || request.limit !== undefined || request.facets !== undefined) return null;
    return new URL("/api/v1/facets", REMIBOORU_QUERY_ORIGIN);
  }
  if (request.resource !== "posts") return null;
  const limit = request.limit === undefined ? maxPageSize : request.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > maxPageSize) return null;
  const url = new URL("/api/v1/posts", REMIBOORU_QUERY_ORIGIN);
  url.searchParams.set("limit", String(limit));
  if (request.cursor !== undefined) {
    if (typeof request.cursor !== "string" || request.cursor.length < 1 || request.cursor.length > 512) return null;
    url.searchParams.set("cursor", request.cursor);
  }
  if (request.facets !== undefined) {
    if (!Array.isArray(request.facets) || request.facets.length > MAX_REMIBOORU_FACETS) return null;
    for (const facet of request.facets) {
      if (typeof facet !== "string" || facet.length < 1 || facet.length > MAX_REMIBOORU_FACET_LENGTH) return null;
      url.searchParams.append("facet", facet);
    }
  }
  return url;
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function sameOriginPath(value: unknown, pathPrefix: string): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.origin === REMIBOORU_QUERY_ORIGIN && url.pathname.startsWith(pathPrefix) ? url.href : null;
  } catch {
    return null;
  }
}

export type SanitizedRemibooruPostPage = {
  items: Array<{
    id: string;
    postUrl: string;
    thumbnailUrl: string;
    media: { contentType: string; width: number; height: number; isGif: boolean };
    facets: Array<{ kind: string; value: string; category: string }>;
    attribution: { label: string; uploader: string | null };
  }>;
  nextCursor: string | null;
};

export function sanitizeRemibooruPosts(payload: unknown): SanitizedRemibooruPostPage | null {
  const root = object(payload);
  if (!root || !Array.isArray(root.posts) || root.posts.length > MAX_REMIBOORU_PAGE_SIZE) return null;
  const items: SanitizedRemibooruPostPage["items"] = [];
  for (const rawPost of root.posts) {
    const post = object(rawPost);
    const thumbnail = object(post?.thumbnail);
    const media = object(post?.media);
    const uploader = object(post?.uploader);
    const id = post?.id;
    const postUrl = sameOriginPath(post?.postUrl, "/posts/");
    const thumbnailUrl = sameOriginPath(thumbnail?.url, "/media/thumbs/");
    const width = media?.width;
    const height = media?.height;
    if (typeof id !== "string" || id.length < 1 || id.length > 128 || !postUrl || !thumbnailUrl
      || typeof media?.contentType !== "string" || typeof width !== "number" || typeof height !== "number"
      || !Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 20_000 || height > 20_000 || typeof media.isGif !== "boolean") return null;
    const facets = Array.isArray(post?.facets) ? post.facets.slice(0, 56).flatMap((rawFacet) => {
      const facet = object(rawFacet);
      return facet && typeof facet.kind === "string" && typeof facet.value === "string" && typeof facet.category === "string"
        ? [{ kind: facet.kind, value: facet.value, category: facet.category }]
        : [];
    }) : [];
    items.push({
      id,
      postUrl,
      thumbnailUrl,
      media: { contentType: media.contentType, width, height, isGif: media.isGif },
      facets,
      attribution: { label: "Remibooru", uploader: typeof uploader?.displayName === "string" ? uploader.displayName : typeof uploader?.handle === "string" ? uploader.handle : null },
    });
  }
  return { items, nextCursor: typeof root.nextCursor === "string" && root.nextCursor.length <= 512 ? root.nextCursor : null };
}

export function sanitizeRemibooruFacets(payload: unknown): Array<{ kind: string; value: string; category: string; postCount: number }> | null {
  const root = object(payload);
  if (!root || !Array.isArray(root.facets) || root.facets.length > 56) return null;
  const facets = [];
  for (const rawFacet of root.facets) {
    const facet = object(rawFacet);
    if (!facet || typeof facet.kind !== "string" || typeof facet.value !== "string" || typeof facet.category !== "string" || typeof facet.postCount !== "number") return null;
    facets.push({ kind: facet.kind, value: facet.value, category: facet.category, postCount: facet.postCount });
  }
  return facets;
}
