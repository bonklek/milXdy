import { authorizeBackgroundMessage, type BackgroundMessageAuthorization } from "./background-message-policy";

export type AuthorizedBackgroundMessageHandlers<Result> = {
  denied: (authorization: BackgroundMessageAuthorization) => Result;
  authorized: (authorization: BackgroundMessageAuthorization) => Result;
};

export function dispatchAuthorizedBackgroundMessage<Result>(
  message: unknown,
  declaredPatterns: readonly string[] | undefined,
  handlers: AuthorizedBackgroundMessageHandlers<Result>,
): Result {
  const authorization = authorizeBackgroundMessage(message, declaredPatterns);
  return authorization.authorized
    ? handlers.authorized(authorization)
    : handlers.denied(authorization);
}
