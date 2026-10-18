export type PostReadingPerformancePolicy = {
  batchSize: number;
  maxPendingTweets: number;
  maxHighlightChars: number;
  maxHighlightTokens: number;
};

export function postReadingPerformancePolicy(): PostReadingPerformancePolicy {
  const mode = document.documentElement.dataset.milxdyPerformanceMode || "balanced";
  if (mode === "fast") {
    return { batchSize: 2, maxPendingTweets: 16, maxHighlightChars: 700, maxHighlightTokens: 96 };
  }
  if (mode === "balanced") {
    return { batchSize: 4, maxPendingTweets: 36, maxHighlightChars: 6000, maxHighlightTokens: 800 };
  }
  if (mode === "developer") {
    return { batchSize: 16, maxPendingTweets: 160, maxHighlightChars: Number.POSITIVE_INFINITY, maxHighlightTokens: Number.POSITIVE_INFINITY };
  }
  return { batchSize: 8, maxPendingTweets: 96, maxHighlightChars: 9000, maxHighlightTokens: 1200 };
}
