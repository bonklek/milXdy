import { displayNameTextIsMarked, markDisplayNameText } from "../visuals/display-name";

export function markTweetHeaderScaffold(tweet: HTMLElement, ownsNode: (node: HTMLElement) => boolean): boolean {
  let marked = false;
  for (const userName of Array.from(tweet.querySelectorAll<HTMLElement>('[data-testid="User-Name"]'))) {
    if (!ownsNode(userName)) continue;
    const displayNameLink = findDisplayNameLink(userName);
    if (!displayNameLink) continue;
    const displayRow = displayNameLink.parentElement;
    const displayCluster = displayRow?.parentElement;
    const metadataRow = findMetadataRow(userName, displayRow);
    userName.dataset.milxdyTweetHeader = "true";
    const detailHeader = !userName.querySelector("time");
    userName.toggleAttribute("data-milxdy-detail-header", detailHeader);
    userName.parentElement?.toggleAttribute("data-milxdy-detail-author-wrapper", detailHeader);
    userName.parentElement?.parentElement?.toggleAttribute("data-milxdy-detail-author-column", detailHeader);
    if (displayCluster && displayCluster.parentElement === userName) {
      displayCluster.setAttribute("data-milxdy-display-name-cluster", "true");
    }
    displayRow?.setAttribute("data-milxdy-display-name-row", "true");
    displayNameLink.setAttribute("data-milxdy-display-name", "true");
    markDisplayNameText(displayNameLink);
    metadataRow?.setAttribute("data-milxdy-metadata-row", "true");
    marked = true;
  }
  return marked;
}

function findDisplayNameLink(userName: HTMLElement): HTMLElement | null {
  const links = Array.from(userName.querySelectorAll<HTMLElement>('a[role="link"], a[href^="/"]'));
  return links.find((link) => {
    if (link.querySelector("time")) return false;
    const text = (link.textContent || "").trim();
    return Boolean(text) && !text.startsWith("@");
  }) || null;
}

function findMetadataRow(userName: HTMLElement, displayRow: HTMLElement | null): HTMLElement | null {
  const time = userName.querySelector("time");
  const handle = Array.from(userName.querySelectorAll<HTMLElement>("span")).find((span) => {
    return (span.textContent || "").trim().startsWith("@");
  });
  const candidates = [time, handle].flatMap((element): HTMLElement[] => {
    const rows: HTMLElement[] = [];
    let current = element?.parentElement;
    while (current && current !== userName) {
      if (current.tagName === "DIV") rows.push(current);
      current = current.parentElement;
    }
    return rows;
  });
  return candidates.find((row) => row.parentElement === userName && row !== displayRow && !row.contains(displayRow))
    || candidates.find((row) => row !== displayRow && !row.contains(displayRow))
    || (displayRow?.parentElement ?? null);
}

/** Cached markers are valid only while every current name owns its text marker. */
export function tweetHeaderScaffoldPresent(tweet: HTMLElement, ownsNode: (node: HTMLElement) => boolean): boolean {
  const headers = Array.from(tweet.querySelectorAll<HTMLElement>('[data-testid="User-Name"]')).filter(ownsNode);
  return headers.length > 0 && headers.every(header => {
    const link = findDisplayNameLink(header);
    return header.dataset.milxdyTweetHeader === "true" && Boolean(link && link.dataset.milxdyDisplayName === "true" && displayNameTextIsMarked(link));
  });
}
