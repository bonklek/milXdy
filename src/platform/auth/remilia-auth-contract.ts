export type RemiliaAuthErrorCode =
  | "AUTH_REQUIRED"
  | "MIGRATION_REQUIRED"
  | "ACCESS_DENIED"
  | "CANCELLED"
  | "AUTH_TIMEOUT"
  | "CONCURRENT_LOGIN"
  | "AUTH_SETUP_FAILED"
  | "AUTH_PAGE_LOAD_FAILED"
  | "AUTH_WINDOW_UNAVAILABLE"
  | "AUTH_WINDOW_FAILED"
  | "AUTH_RESPONSE_INVALID"
  | "AUTH_STORAGE_FAILED"
  | "REDIRECT_MISMATCH"
  | "STATE_MISMATCH"
  | "NONCE_MISMATCH"
  | "DISCOVERY_FAILED"
  | "TOKEN_EXCHANGE_FAILED"
  | "TOKEN_REQUEST_REJECTED"
  | "TOKEN_RESPONSE_INVALID"
  | "SIGNING_KEYS_UNAVAILABLE"
  | "ID_TOKEN_INVALID"
  | "ID_TOKEN_FORMAT_INVALID"
  | "ID_TOKEN_ALGORITHM_INVALID"
  | "ID_TOKEN_SIGNING_KEY_INVALID"
  | "ID_TOKEN_SIGNATURE_INVALID"
  | "ID_TOKEN_ISSUER_INVALID"
  | "ID_TOKEN_AUDIENCE_INVALID"
  | "ID_TOKEN_TIME_INVALID"
  | "ID_TOKEN_SUBJECT_INVALID"
  | "TOKEN_EXPIRED"
  | "REFRESH_REJECTED"
  | "MISSING_SCOPE"
  | "OFFLINE"
  | "REVOKED"
  | "UNSUPPORTED"
  | "UNKNOWN";

export type RemiliaUiErrorCode =
  | "ACCESS_DENIED"
  | "TOKEN_EXPIRED"
  | "MISSING_SCOPE"
  | "RATE_LIMITED"
  | "OFFLINE"
  | "CANCELLED"
  | "CONCURRENT_LOGIN"
  | "AUTH_TIMEOUT"
  | "AUTH_SETUP_FAILED"
  | "AUTH_PAGE_LOAD_FAILED"
  | "AUTH_WINDOW_UNAVAILABLE"
  | "AUTH_WINDOW_FAILED"
  | "AUTH_RESPONSE_INVALID"
  | "TOKEN_EXCHANGE_FAILED"
  | "TOKEN_REQUEST_REJECTED"
  | "TOKEN_RESPONSE_INVALID"
  | "SIGNING_KEYS_UNAVAILABLE"
  | "ID_TOKEN_INVALID"
  | "ID_TOKEN_FORMAT_INVALID"
  | "ID_TOKEN_ALGORITHM_INVALID"
  | "ID_TOKEN_SIGNING_KEY_INVALID"
  | "ID_TOKEN_SIGNATURE_INVALID"
  | "ID_TOKEN_ISSUER_INVALID"
  | "ID_TOKEN_AUDIENCE_INVALID"
  | "ID_TOKEN_TIME_INVALID"
  | "ID_TOKEN_SUBJECT_INVALID"
  | "AUTH_STORAGE_FAILED"
  | "REVOKED"
  | "UNSUPPORTED"
  | "UNKNOWN";

export type RemiliaAuthIdentity = {
  id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
};

export type RemiliaAuthGrant =
  | {
    ok: true;
    accessToken: string;
    tokenType: "Bearer";
    expiresAt: number;
    grantedScopes: string[];
  }
  | {
    ok: false;
    error: RemiliaAuthErrorCode;
    grantedScopes: string[];
    missingScopes: string[];
  };

export type RemiliaAuthStatus = {
  phase: "unsupported" | "migration-required" | "disconnected" | "connecting" | "connected" | "expired" | "missing-scope" | "rate-limited" | "offline" | "error";
  identity?: RemiliaAuthIdentity;
  grantedScopes: string[];
  requiredScopes: string[];
  migration: {
    version: 1;
    required: boolean;
    legacyDeleted: boolean;
  };
  lastError?: {
    code: RemiliaUiErrorCode;
    retryAfterSeconds?: number;
  };
};

export interface RemiliaAuthProvider {
  prepare(requiredScopes?: readonly string[], options?: { signal?: AbortSignal }): Promise<RemiliaAuthGrant>;
  refresh(requiredScopes?: readonly string[], options?: { signal?: AbortSignal }): Promise<RemiliaAuthGrant>;
}

export type StoredCredentials = {
  version: 1;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
  grantedScopes: string[];
  identity: RemiliaAuthIdentity;
};

export type AuthControl = {
  version: 1;
  disconnected: boolean;
  migration: {
    version: 1;
    required: boolean;
    legacyDeleted: boolean;
  };
  lastError?: {
    code: RemiliaUiErrorCode;
    retryAfterSeconds?: number;
  };
};

export type OidcDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  revocation_endpoint?: string;
  end_session_endpoint?: string;
  userinfo_endpoint?: string;
  code_challenge_methods_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
};

export type TokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  id_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  error?: unknown;
};
