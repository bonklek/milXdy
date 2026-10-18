import type { ReminetIdentityProfile } from "../../platform/auth/reminet-identity";

type SendMessage = (message: Record<string, unknown>, label: string) => Promise<any>;
type BadgeLookup = { status: "resolved" | "not_found" | "error"; profile?: Partial<ReminetIdentityProfile> };

/** Badge data is public; directory authorization remains separate for actions. */
export async function resolveBadgeProfiles(handles: readonly string[], send: SendMessage): Promise<BadgeLookup[]> {
  const directory = await send({
    type: "reminetIdentity:resolve",
    identifiers: handles.map(value => ({ type: "x_handle", value })),
  }, "reminetIdentity:resolve").catch(() => null);

  return Promise.all(handles.map(async (handle, index): Promise<BadgeLookup> => {
    const resolved = directory?.ok ? directory.results?.[index] : null;
    if (resolved?.status === "resolved" && resolved.profile) return resolved;
    const response = await send({ type: "remistats:getUser", handle }, "remistats:getUser").catch(() => null);
    if (response?.ok) {
      const user = response.data?.user;
      const xHandle = typeof user?.twitterHandle === "string" ? user.twitterHandle.replace(/^@/, "").toLowerCase() : handle;
      // Never attach another account's cached or upstream response to this post.
      if (!user || typeof user.username !== "string" || xHandle !== handle.toLowerCase()) return { status: "error" };
      return { status: "resolved", profile: {
        remiliaUsername: user.username,
        xHandle,
        displayName: user.displayName,
        remiStatsScore: numeric(user.socialCreditScore ?? user.socialCredit),
        beetleCount: numeric(user.beetles),
        friendCount: numeric(user.friendCount),
        pfpProject: user.pfpProject,
        pfpId: user.pfpId,
      } };
    }
    // Transient failures must remain retryable, rather than cached as absent.
    return { status: response?.notFound === true && response.status === 404 ? "not_found" : "error" };
  }));
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
