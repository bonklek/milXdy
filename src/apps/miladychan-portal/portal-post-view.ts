import type { ChanPost, ChanImage } from "./portal-contract";
import { API_ROOT, boardTheme, relativeTime, imageUrl, fileExtension } from "./portal-data";

export function createPost(post: ChanPost, fallbackBoard: string, onReply: (postId: number) => void, onJump: (postId: number) => void): HTMLElement {
  const article = document.createElement("div");
  article.className = "milxdy-chan-post";
  article.dataset.boardTheme = boardTheme(post.board || fallbackBoard);
  article.dataset.postId = String(post.id);
  const meta = document.createElement("header");
  const author = document.createElement("strong");
  author.textContent = post.user?.displayname || post.name || "milady";
  const id = document.createElement("button");
  id.type = "button";
  id.className = "milxdy-chan-post-reply";
  id.textContent = `No. ${post.id} · ${relativeTime(post.time)}`;
  id.setAttribute("aria-label", `Reply to post ${post.id}`);
  id.addEventListener("click", () => onReply(post.id));
  meta.append(author, id);
  article.append(meta);
  const media = createMedia(post.image, post.board || fallbackBoard, post.id);
  if (media) article.append(media);
  if (post.body) {
    article.append(createPostBody(post.body, onJump));
  }
  return article;
}

export function createPostBody(body: string, onJump: (postId: number) => void): HTMLElement {
  const text = document.createElement("p");
  const referencePattern = /(?<!>)>>(\d+)/gu;
  let cursor = 0;
  for (const match of body.matchAll(referencePattern)) {
    const index = match.index ?? cursor;
    if (index > cursor) text.append(document.createTextNode(body.slice(cursor, index)));
    const postId = Number(match[1]);
    const reference = document.createElement("button");
    reference.type = "button";
    reference.className = "milxdy-chan-post-reference";
    reference.textContent = match[0];
    reference.title = `Jump to No. ${postId}`;
    reference.setAttribute("aria-label", `Jump to post ${postId}`);
    reference.addEventListener("click", () => onJump(postId));
    text.append(reference);
    cursor = index + match[0].length;
  }
  if (cursor < body.length) text.append(document.createTextNode(body.slice(cursor)));
  return text;
}

export function createMedia(image: ChanImage | null | undefined, board: string, postId: number): HTMLElement | null {
  const thumb = imageUrl(image, "thumb");
  const src = imageUrl(image, "src");
  if (!thumb && !src) return null;
  const link = document.createElement("a");
  link.className = "milxdy-chan-media";
  link.href = src || `${API_ROOT}/${board}/${postId}`;
  link.target = "_blank";
  link.rel = "noreferrer";
  const fileType = fileExtension(image?.file_type);
  if (thumb && fileType !== "mp3" && fileType !== "flac") {
    const img = document.createElement("img");
    img.src = thumb;
    img.alt = "";
    img.loading = "lazy";
    link.append(img);
  } else {
    const fallback = document.createElement("span");
    fallback.textContent = fileType ? fileType.toUpperCase() : "FILE";
    link.append(fallback);
  }
  return link;
}

export function emptyState(text: string): HTMLElement {
  const node = document.createElement("div");
  node.className = "milxdy-chan-empty";
  node.textContent = text;
  return node;
}

export function loadingState(text: string): HTMLElement {
  const node = document.createElement("div");
  node.className = "milxdy-chan-loading";
  const indicator = document.createElement("span");
  indicator.setAttribute("aria-hidden", "true");
  const label = document.createElement("strong");
  label.textContent = text;
  node.append(indicator, label);
  return node;
}
