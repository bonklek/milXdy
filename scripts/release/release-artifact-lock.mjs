import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const LOCK_ROOT = "tmp";
const LOCK_DIR = join(LOCK_ROOT, "release-artifacts.lock");
const TOKEN_ENV = "MILXDY_RELEASE_ARTIFACT_LOCK_TOKEN";
const DIR_ENV = "MILXDY_RELEASE_ARTIFACT_LOCK_DIR";
const OWNER_WRITE_GRACE_MS = 5000;

export async function withReleaseArtifactLock(label, task) {
  if (await hasInheritedLock()) {
    return task();
  }

  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await acquireReleaseArtifactLock(label, token);

  const previousToken = process.env[TOKEN_ENV];
  const previousDir = process.env[DIR_ENV];
  process.env[TOKEN_ENV] = token;
  process.env[DIR_ENV] = LOCK_DIR;
  try {
    return await task();
  } finally {
    restoreEnv(TOKEN_ENV, previousToken);
    restoreEnv(DIR_ENV, previousDir);
    await releaseLock(token);
  }
}

async function acquireReleaseArtifactLock(label, token) {
  await mkdir(LOCK_ROOT, { recursive: true });
  while (true) {
    try {
      await mkdir(LOCK_DIR);
      await writeOwner(label, token);
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (await removeStaleLock()) continue;
      throw new Error(await activeLockMessage(label));
    }
  }
}

async function hasInheritedLock() {
  if (process.env[DIR_ENV] !== LOCK_DIR || !process.env[TOKEN_ENV]) return false;
  const owner = await readOwner();
  return owner?.token === process.env[TOKEN_ENV];
}

async function writeOwner(label, token) {
  const owner = {
    label,
    pid: process.pid,
    token,
    startedAt: new Date().toISOString(),
  };
  await writeFile(join(LOCK_DIR, "owner.json"), `${JSON.stringify(owner, null, 2)}\n`);
}

async function readOwner() {
  try {
    return JSON.parse(await readFile(join(LOCK_DIR, "owner.json"), "utf8"));
  } catch {
    return null;
  }
}

async function removeStaleLock() {
  const owner = await readOwner();
  if (owner?.pid && isProcessAlive(owner.pid)) return false;
  if (!owner && !(await isOwnerlessLockStale())) return false;
  await rm(LOCK_DIR, { recursive: true, force: true });
  return true;
}

async function isOwnerlessLockStale() {
  try {
    const info = await stat(LOCK_DIR);
    return Date.now() - info.mtimeMs > OWNER_WRITE_GRACE_MS;
  } catch {
    return true;
  }
}

async function activeLockMessage(label) {
  const owner = await readOwner();
  const detail = owner
    ? `${owner.label || "release artifact task"} pid ${owner.pid || "unknown"} started ${owner.startedAt || "at an unknown time"}`
    : "another release artifact task";
  return `${label} cannot run while ${detail} owns ${LOCK_DIR}. Rerun after that process exits, or delete the lock only after confirming the owner process is gone.`;
}

async function releaseLock(token) {
  const owner = await readOwner();
  if (owner?.token !== token) return;
  await rm(LOCK_DIR, { recursive: true, force: true });
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function restoreEnv(name, previousValue) {
  if (previousValue === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = previousValue;
  }
}

export async function writeFileAtomically(path, data) {
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await writeFile(tempPath, data);
  await renameOver(tempPath, path);
}

export async function publishFileAtomically(tempPath, finalPath) {
  await renameOver(tempPath, finalPath);
}

async function renameOver(tempPath, finalPath) {
  const { rename } = await import("node:fs/promises");
  await rename(tempPath, finalPath);
}
