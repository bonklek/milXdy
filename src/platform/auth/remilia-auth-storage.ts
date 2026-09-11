import type { AuthControl, RemiliaUiErrorCode, StoredCredentials } from "./remilia-auth-contract";
import { AuthProtocolError, CONTROL_KEY, CREDENTIALS_KEY, normalizeScopes } from "./remilia-auth-shared";

let sessionAccessConfigured = false;

async function readCredentials(): Promise<StoredCredentials | null> {
  await configureSessionAccess();
  const session = chrome.storage.session;
  if (!session) throw new AuthProtocolError("UNSUPPORTED");
  const stored = await session.get(CREDENTIALS_KEY);
  const credentials = normalizeCredentials(stored[CREDENTIALS_KEY]);
  if (!credentials && stored[CREDENTIALS_KEY] !== undefined) await session.remove(CREDENTIALS_KEY);
  return credentials;
}

async function writeCredentials(credentials: StoredCredentials): Promise<void> {
  await configureSessionAccess();
  if (!chrome.storage.session) throw new AuthProtocolError("UNSUPPORTED");
  await chrome.storage.session.set({ [CREDENTIALS_KEY]: credentials });
}

async function clearCredentials(): Promise<void> {
  await configureSessionAccess();
  await chrome.storage.session?.remove(CREDENTIALS_KEY);
}

async function configureSessionAccess(): Promise<void> {
  if (sessionAccessConfigured) return;
  if (!chrome.storage.session) throw new AuthProtocolError("UNSUPPORTED");
  await chrome.storage.session.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => undefined);
  sessionAccessConfigured = true;
}

async function readControl(): Promise<AuthControl> {
  const stored = await chrome.storage.local.get(CONTROL_KEY);
  return normalizeControl(stored[CONTROL_KEY]) || {
    version: 1,
    disconnected: true,
    migration: { version: 1, required: false, legacyDeleted: false },
  };
}

async function writeControl(control: AuthControl): Promise<void> {
  await chrome.storage.local.set({ [CONTROL_KEY]: control });
}

async function setLastError(code?: RemiliaUiErrorCode): Promise<void> {
  const control = await readControl();
  await writeControl({ ...control, lastError: code ? { code } : undefined });
}

function normalizeCredentials(value: unknown): StoredCredentials | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<StoredCredentials>;
  if (raw.version !== 1
    || typeof raw.accessToken !== "string"
    || typeof raw.refreshToken !== "string"
    || typeof raw.idToken !== "string"
    || typeof raw.expiresAt !== "number"
    || !Array.isArray(raw.grantedScopes)
    || !raw.identity
    || typeof raw.identity.id !== "string") return null;
  return {
    version: 1,
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
    idToken: raw.idToken,
    expiresAt: raw.expiresAt,
    grantedScopes: normalizeScopes(raw.grantedScopes.join(" ")),
    identity: raw.identity,
  };
}

function normalizeControl(value: unknown): AuthControl | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<AuthControl>;
  if (raw.version !== 1 || typeof raw.disconnected !== "boolean"
    || !raw.migration || raw.migration.version !== 1
    || typeof raw.migration.required !== "boolean"
    || typeof raw.migration.legacyDeleted !== "boolean") return null;
  return raw as AuthControl;
}


export { clearCredentials, normalizeControl, readControl, readCredentials, setLastError, writeControl, writeCredentials };
