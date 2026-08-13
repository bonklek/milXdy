import {
  remiliaCapabilityForOperation,
  validateRemiliaCapabilityDeclarations,
  type AppRemiliaCapabilityDeclaration,
  type RemiliaCapabilityBrokerResult,
  type RemiliaCapabilityOperation,
  type RemiliaCapabilityParams,
} from "../app-sdk/remilia-capabilities";
import {
  REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE,
  REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE,
  REMILIA_CAPABILITY_REVOKE_MESSAGE_TYPE,
} from "../background/remilia-capability-broker";
import type { MilxdyAppManifest } from "../app-sdk/app-platform";

export type RemiliaCapabilityTransport = (message: unknown) => Promise<unknown | null>;

export type PackageRemiliaCapabilityClient = {
  declarations: ReadonlyArray<AppRemiliaCapabilityDeclaration>;
  invoke<Operation extends RemiliaCapabilityOperation>(
    operation: Operation,
    params: RemiliaCapabilityParams[Operation],
  ): Promise<RemiliaCapabilityBrokerResult>;
  revoke(): Promise<void>;
};

export function createPackageRemiliaCapabilityClient(
  app: MilxdyAppManifest,
  transport: RemiliaCapabilityTransport,
  hasUserActivation: () => boolean = () => globalThis.navigator?.userActivation?.isActive === true,
): PackageRemiliaCapabilityClient {
  const declarations = validateRemiliaCapabilityDeclarations(app.remiliaCapabilities)
    ? structuredClone(app.remiliaCapabilities)
    : [];
  const packageMetadata = app.localPackage;
  const grantId = randomGrantId();
  let granted = false;
  let revoked = false;

  async function ensureGrant(): Promise<RemiliaCapabilityBrokerResult | null> {
    if (revoked) return localFailure("grant_revoked", "The capability grant is no longer active.");
    if (granted) return null;
    if (declarations.length === 0) return localFailure("capability_not_declared", "The package did not declare a Remilia capability.");
    const packageSource = packageMetadata ? "reviewedLocal" : "firstParty";
    if (packageSource === "reviewedLocal" && packageMetadata?.reviewStatus !== "reviewed") return localFailure("package_not_reviewed", "The package is not reviewed for Remilia capabilities.");
    if (packageSource === "reviewedLocal" && packageMetadata?.packageConsentAcknowledged !== true) return localFailure("consent_required", "Package capability consent was not acknowledged.");
    const manifestSha256 = packageSource === "reviewedLocal"
      ? packageMetadata?.manifestSha256
      : await firstPartyManifestFingerprint(app, declarations);
    if (typeof manifestSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(manifestSha256)) return localFailure("package_not_granted", "The reviewed package identity is unavailable.");
    const result = await transport({
      type: REMILIA_CAPABILITY_GRANT_MESSAGE_TYPE,
      packageId: app.id,
      grantId,
      manifestSha256,
      packageSource,
      reviewStatus: "reviewed",
      consentAcknowledged: true,
      declarations,
    });
    if (!isRecord(result) || result.ok !== true) return normalizeTransportFailure(result);
    granted = true;
    return null;
  }

  return {
    declarations,
    async invoke(operation, params) {
      const definition = remiliaCapabilityForOperation(operation);
      const declaration = definition && declarations.find((candidate) => candidate.id === definition.id);
      if (!definition || !declaration || !declaration.operations.includes(operation)) {
        return localFailure("operation_not_declared", "The package did not declare this Remilia operation.");
      }
      const userGesture = definition.consent === "perInvocation" ? hasUserActivation() : false;
      if (definition.consent === "perInvocation" && !userGesture) {
        return localFailure("consent_required", "This Remilia operation requires an active user gesture.");
      }
      const grantFailure = await ensureGrant();
      if (grantFailure) return grantFailure;
      const result = await transport({
        type: REMILIA_CAPABILITY_INVOKE_MESSAGE_TYPE,
        packageId: app.id,
        grantId,
        operation,
        params,
        ...(userGesture ? { userGesture: true } : {}),
      });
      return normalizeTransportFailure(result);
    },
    async revoke() {
      if (revoked) return;
      revoked = true;
      if (!granted) return;
      granted = false;
      await transport({ type: REMILIA_CAPABILITY_REVOKE_MESSAGE_TYPE, packageId: app.id, grantId }).catch(() => null);
    },
  };
}

function normalizeTransportFailure(value: unknown): RemiliaCapabilityBrokerResult {
  if (isRecord(value) && typeof value.ok === "boolean") return value as RemiliaCapabilityBrokerResult;
  return localFailure("client_unavailable", "The Remilia capability service is unavailable.");
}

function localFailure(code: "grant_revoked" | "capability_not_declared" | "operation_not_declared" | "package_not_reviewed" | "package_not_granted" | "consent_required" | "client_unavailable", message: string): RemiliaCapabilityBrokerResult {
  return { ok: false, error: { category: "broker", code, message, status: code === "client_unavailable" ? 0 : 403 } };
}

function randomGrantId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function firstPartyManifestFingerprint(app: MilxdyAppManifest, declarations: readonly AppRemiliaCapabilityDeclaration[]): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const canonical = JSON.stringify({ id: app.id, version: app.version, remiliaCapabilities: declarations });
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
