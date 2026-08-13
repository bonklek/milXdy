import { remiliaAuthProvider } from "../auth/remilia-auth";
import { RemiliaApiClient } from "../auth/remilia-api";
import { registerBackgroundMessageHandlers } from "./router";
import { createRemiliaApiRouterHandlers } from "./remilia-api-router";

export const remiliaApiClient = new RemiliaApiClient({ auth: remiliaAuthProvider });
registerBackgroundMessageHandlers(createRemiliaApiRouterHandlers(remiliaApiClient));
