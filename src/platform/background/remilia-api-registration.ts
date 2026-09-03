import { remiliaAuthProvider } from "../auth/remilia-auth";
import { RemiliaApiClient } from "../auth/remilia-api";
import { createRemiliaCapabilityBrokerHandlers } from "./remilia-capability-broker";
import { registerBackgroundMessageHandlers } from "./router";

export const remiliaApiClient = new RemiliaApiClient({ auth: remiliaAuthProvider });
registerBackgroundMessageHandlers(createRemiliaCapabilityBrokerHandlers(remiliaApiClient));
