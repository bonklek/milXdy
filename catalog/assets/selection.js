export function selectionFor(packages) {
  return {
    schemaVersion: 1,
    catalog: { id: "milxdy-github-catalog" },
    packages: packages
      .map((pkg) => ({
        id: pkg.id,
        url: pkg.download.url,
        filename: pkg.download.filename,
        sha256: pkg.download.sha256,
        review: {
          identity: pkg.review.reviewedBy,
          date: pkg.review.reviewedAt,
        },
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function selectionJson(packages) {
  return `${JSON.stringify(selectionFor(packages), null, 2)}\n`;
}
