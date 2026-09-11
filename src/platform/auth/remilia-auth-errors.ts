import type { RemiliaAuthErrorCode, RemiliaUiErrorCode } from "./remilia-auth-contract";
import { AuthProtocolError, isAbortError, isTimeoutError } from "./remilia-auth-shared";

function normalizeAuthError(error: unknown): RemiliaAuthErrorCode {
  if (error instanceof AuthProtocolError) return error.code;
  if (isTimeoutError(error)) return "AUTH_TIMEOUT";
  if (isAbortError(error)) return "CANCELLED";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("user did not approve") || message.includes("access denied")) return "ACCESS_DENIED";
  if (message.includes("canceled") || message.includes("cancelled") || message.includes("closed")) return "CANCELLED";
  if (message.includes("only one web auth flow") || (message.includes("web auth flow") && message.includes("in progress"))) {
    return "CONCURRENT_LOGIN";
  }
  if (message.includes("authorization page could not be loaded") || message.includes("authorization page load timed out")) {
    return "AUTH_PAGE_LOAD_FAILED";
  }
  if (message.includes("identity api is disabled in incognito")
    || message.includes("couldn't create a browser window")
    || message.includes("browser context has been shut down")
    || message.includes("auth url has an invalid scheme")
    || message.includes("did not redirect to the right url")) {
    return "AUTH_WINDOW_UNAVAILABLE";
  }
  return "UNKNOWN";
}

function toUiError(code: RemiliaAuthErrorCode): RemiliaUiErrorCode {
  if (code === "ACCESS_DENIED" || code === "TOKEN_EXPIRED" || code === "MISSING_SCOPE"
    || code === "OFFLINE" || code === "CANCELLED" || code === "CONCURRENT_LOGIN"
    || code === "AUTH_TIMEOUT" || code === "REVOKED" || code === "UNSUPPORTED"
    || code === "AUTH_SETUP_FAILED" || code === "AUTH_PAGE_LOAD_FAILED"
    || code === "AUTH_WINDOW_UNAVAILABLE" || code === "AUTH_WINDOW_FAILED"
    || code === "AUTH_RESPONSE_INVALID" || code === "TOKEN_EXCHANGE_FAILED"
    || code === "TOKEN_REQUEST_REJECTED" || code === "TOKEN_RESPONSE_INVALID"
    || code === "SIGNING_KEYS_UNAVAILABLE" || code === "ID_TOKEN_INVALID"
    || code === "ID_TOKEN_FORMAT_INVALID" || code === "ID_TOKEN_ALGORITHM_INVALID"
    || code === "ID_TOKEN_SIGNING_KEY_INVALID" || code === "ID_TOKEN_SIGNATURE_INVALID"
    || code === "ID_TOKEN_ISSUER_INVALID" || code === "ID_TOKEN_AUDIENCE_INVALID"
    || code === "ID_TOKEN_TIME_INVALID" || code === "ID_TOKEN_SUBJECT_INVALID"
    || code === "AUTH_STORAGE_FAILED") return code;
  if (code === "REFRESH_REJECTED") return "TOKEN_EXPIRED";
  if (code === "DISCOVERY_FAILED" || code === "REDIRECT_MISMATCH") return "AUTH_SETUP_FAILED";
  if (code === "STATE_MISMATCH" || code === "NONCE_MISMATCH") return "AUTH_RESPONSE_INVALID";
  return "UNKNOWN";
}

function authErrorForStage(stage: "setup" | "launch" | "response" | "exchange" | "custody"): RemiliaAuthErrorCode {
  if (stage === "launch") return "AUTH_WINDOW_FAILED";
  if (stage === "response") return "AUTH_RESPONSE_INVALID";
  if (stage === "exchange") return "TOKEN_EXCHANGE_FAILED";
  if (stage === "custody") return "AUTH_STORAGE_FAILED";
  return "AUTH_SETUP_FAILED";
}


function launchIdentityWebAuthFlow(url: string): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const succeed = (callbackUrl?: string) => {
      if (settled) return;
      settled = true;
      resolve(callbackUrl);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      const code = normalizeAuthError(error);
      reject(new AuthProtocolError(code === "UNKNOWN" ? "AUTH_WINDOW_FAILED" : code));
    };
    const callback = (callbackUrl?: string) => {
      const nativeMessage = chrome.runtime.lastError?.message;
      if (nativeMessage) fail(new Error(nativeMessage));
      else succeed(callbackUrl);
    };
    try {
      const returned = chrome.identity.launchWebAuthFlow(
        { url, interactive: true },
        callback,
      ) as Promise<string | undefined> | undefined;
      if (returned && typeof returned.then === "function") returned.then(succeed, fail);
    } catch (error) {
      fail(error);
    }
  });
}


export { authErrorForStage, launchIdentityWebAuthFlow, normalizeAuthError, toUiError };
