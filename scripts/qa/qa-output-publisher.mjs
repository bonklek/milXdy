import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, readdir, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export async function promoteLastKnownGood(staging, output, { publishMirror = mirrorDirectoryContents } = {}) {
  await mkdir(dirname(output), { recursive: true });
  const publishStaging = `${output}.staging-${process.pid}-${Date.now()}`;
  const backup = `${output}.previous-${process.pid}`;
  let preserveBackup = false;
  await rm(publishStaging, { recursive: true, force: true });
  await rm(backup, { recursive: true, force: true });
  try {
    await cp(staging, publishStaging, { recursive: true });
    const hadOutput = existsSync(output);
    if (!hadOutput) {
      await rename(publishStaging, output);
      return;
    }

    // Chrome persists an unpacked extension by its root directory. Renaming that
    // directory away during a publish can make the registered path disappear
    // long enough for Chrome to drop the unpacked extension from the profile.
    // Keep the root continuously present and mirror only its verified contents.
    await cp(output, backup, { recursive: true });
    try {
      await publishMirror(publishStaging, output);
    } catch (publishError) {
      try {
        await mirrorDirectoryContents(backup, output);
      } catch (rollbackError) {
        preserveBackup = true;
        throw new Error(`publish failed (${errorMessage(publishError)}) and rollback failed (${errorMessage(rollbackError)}); recovery copy retained at ${backup}`);
      }
      throw publishError;
    }
  } catch (error) {
    throw new Error(`could not safely promote QA output: ${error instanceof Error ? error.message : error}`);
  } finally {
    await rm(publishStaging, { recursive: true, force: true });
    if (!preserveBackup) await rm(backup, { recursive: true, force: true });
  }
}

async function mirrorDirectoryContents(source, target) {
  await mkdir(target, { recursive: true });
  const [sourceEntries, targetEntries] = await Promise.all([
    readdir(source, { withFileTypes: true }),
    readdir(target, { withFileTypes: true }),
  ]);
  const targetByName = new Map(targetEntries.map((entry) => [entry.name, entry]));
  const sourceNames = new Set(sourceEntries.map((entry) => entry.name));

  for (const entry of sourceEntries) {
    const sourcePath = resolve(source, entry.name);
    const targetPath = resolve(target, entry.name);
    const targetEntry = targetByName.get(entry.name);
    if (entry.isDirectory()) {
      if (targetEntry && !targetEntry.isDirectory()) await rm(targetPath, { recursive: true, force: true });
      await mirrorDirectoryContents(sourcePath, targetPath);
    } else if (entry.isFile()) {
      if (targetEntry && !targetEntry.isFile()) await rm(targetPath, { recursive: true, force: true });
      await copyFile(sourcePath, targetPath);
    } else {
      if (targetEntry) await rm(targetPath, { recursive: true, force: true });
      await cp(sourcePath, targetPath, { recursive: true, force: true, verbatimSymlinks: true });
    }
  }

  for (const entry of targetEntries) {
    if (!sourceNames.has(entry.name)) {
      await rm(resolve(target, entry.name), { recursive: true, force: true });
    }
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

