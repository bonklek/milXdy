export type ExactDirectoryProfileIdentity = {
  xHandle: string;
  remiliaUsername: string;
};

export function exactDirectoryProfileIdentity(
  response: unknown,
  expectedXHandleInput: unknown,
): ExactDirectoryProfileIdentity | null {
  const expectedXHandle = exactXHandle(expectedXHandleInput);
  if (!expectedXHandle || !isRecord(response) || response.ok !== true || !Array.isArray(response.results)) return null;
  if (response.results.length !== 1) return null;

  const result = response.results[0];
  if (!isRecord(result) || result.status !== "resolved" || result.provenance !== "remilia-api-v1:directory") return null;
  const query = isRecord(result.query) ? result.query : null;
  const identity = isRecord(result.identity) ? result.identity : null;
  const queryXHandle = query?.type === "x_handle" ? exactXHandle(query.value) : "";
  const remiliaUsername = remiliaHandle(identity?.handle);
  if (queryXHandle !== expectedXHandle || !remiliaUsername) return null;

  if (result.profile !== null && result.profile !== undefined) {
    if (!isRecord(result.profile)) return null;
    const profileXHandle = result.profile.xHandle === null || result.profile.xHandle === undefined
      ? ""
      : exactXHandle(result.profile.xHandle);
    const profileUsername = result.profile.remiliaUsername === null || result.profile.remiliaUsername === undefined
      ? ""
      : remiliaHandle(result.profile.remiliaUsername);
    if ((profileXHandle && profileXHandle !== expectedXHandle) || (profileUsername && profileUsername !== remiliaUsername)) return null;
  }

  return { xHandle: expectedXHandle, remiliaUsername };
}

function exactXHandle(value: unknown): string {
  if (typeof value !== "string") return "";
  const candidate = value.trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(candidate) ? candidate.toLowerCase() : "";
}

function remiliaHandle(value: unknown): string {
  if (typeof value !== "string") return "";
  const candidate = value.trim().replace(/^[@~]+/, "");
  return /^[A-Za-z0-9_.-]{1,64}$/.test(candidate) ? candidate.toLowerCase() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
