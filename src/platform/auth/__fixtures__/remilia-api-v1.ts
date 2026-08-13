import type { RemiliaApiDocumentedErrorCode, RemiliaApiOperation } from "../remilia-api";

const identity = {
  handle: "remilia",
  display_name: "Remilia",
  avatar_url: "https://www.remilia.net/avatar.png",
  avatar_url_small: "https://www.remilia.net/avatar-small.png",
};

const profile = {
  user: {
    username: "remilia",
    displayName: "Remilia",
    bio: "fixture bio",
    location: "internet",
    pfpUrl: identity.avatar_url,
    friendCount: 1,
    achievementsCount: 2,
  },
  achievementContext: {},
  viewerContext: { areFriends: false },
  isAuthenticated: false,
  isOwnProfile: false,
};

export const REMILIA_API_V1_SUCCESS_FIXTURES: Record<RemiliaApiOperation, unknown> = {
  getUserProfile: profile,
  getMe: {
    ...profile,
    user: { ...profile.user, stats: {}, aggregateScores: {}, property: {} },
    isAuthenticated: true,
    isOwnProfile: true,
  },
  getMyStats: {
    data: {
      handle: "remilia",
      display_name: "Remilia",
      stats: { twitter: {}, beetle_game: {}, ethereum: { cult_tier: "fixture", total_owned: 0, collections: {} } },
      aggregate_scores: { total: 1 },
    },
  },
  listMyNotifications: {
    data: {
      notifications: [{ type: "poke", read: false, from: identity, created_at: 1_754_870_400 }],
      page: 1,
      limit: 20,
      has_more: false,
    },
  },
  getMyBeetle: {
    data: { xp: 100, level: 2, inventory: [], hammer_durabilities: { basic: 3 }, cooldowns: {} },
  },
  getMyBeetleCards: {
    data: { stag_beetle: { codename: "stag_beetle", discovered: true } },
  },
  pokeUser: {
    data: { target_handle: "remilia", poked_at: 1_754_870_400 },
  },
  listGlobalChatMessages: {
    data: {
      messages: [{ id: "1042", author: identity, text: "gm", created_at: 1_754_870_400 }],
      has_more: true,
      next_cursor: "998",
    },
  },
  postGlobalChatMessage: {
    data: { id: "1043", author: identity, text: "gm", reply_to_id: "1042", created_at: 1_754_870_401 },
  },
  resolveDirectory: {
    data: {
      results: [{ query: { type: "handle", value: "remilia" }, identity }],
    },
  },
  listDirectoryUsers: {
    data: { users: [identity], next_cursor: "MTA0Mg" },
  },
};

export const REMILIA_API_V1_ERROR_FIXTURES: Record<RemiliaApiDocumentedErrorCode, { status: number; body: unknown }> = {
  invalid_request: { status: 400, body: { error: { code: "invalid_request", message: "private server detail" } } },
  unauthorized: { status: 401, body: { error: { code: "unauthorized", message: "private server detail" } } },
  invalid_token: { status: 401, body: { error: { code: "invalid_token", message: "private server detail" } } },
  insufficient_scope: { status: 403, body: { error: { code: "insufficient_scope", message: "scope remilia:pokes.write required" } } },
  requires_user: { status: 403, body: { error: { code: "requires_user", message: "private server detail" } } },
  forbidden: { status: 403, body: { error: { code: "forbidden", message: "private server detail" } } },
  not_found: { status: 404, body: { error: { code: "not_found", message: "private server detail" } } },
  user_not_found: { status: 404, body: { error: { code: "user_not_found", message: "private server detail" } } },
  method_not_allowed: { status: 405, body: { error: { code: "method_not_allowed", message: "private server detail" } } },
  rate_limited: { status: 429, body: { error: { code: "rate_limited", message: "private server detail" } } },
  poke_cooldown: {
    status: 429,
    body: { error: { code: "poke_cooldown", message: "poke on cooldown (private detail)", next_allowed_at: 1_754_956_800 } },
  },
  internal_error: { status: 500, body: { error: { code: "internal_error", message: "private server detail" } } },
  invalid_reply: { status: 400, body: { error: { code: "invalid_reply", message: "private server detail" } } },
};
