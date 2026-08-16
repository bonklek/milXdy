import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { releaseBuilds } from "./release-builds.mjs";
import { withReleaseArtifactLock } from "./release-artifact-lock.mjs";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const version = String(packageJson.extensionVersion || packageJson.version || "").trim();
const reportPath = `tmp/release-evidence/remilia-migration-artifact-scan-${version}.json`;
const MAX_ARCHIVE_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_TEXT_SCAN_BYTES = 16 * 1024 * 1024;
const MAX_ANCHOR_ENTITIES = 4096;
const MAX_ANCHORS = 32_768;
const MAX_TOTAL_ANCHOR_ENTITIES = 65_536;
const MAX_ENTITY_NAME_LENGTH = 32;
const MAX_NUMERIC_ENTITY_DIGITS = 8;
const MAX_EMSCRIPTEN_PATH_CANDIDATES = 32_768;
// Unicode Default_Ignorable_Code_Point ranges are explicit so scanner behavior is
// bounded and reviewable rather than changing with the JavaScript runtime's Unicode data.
const DEFAULT_IGNORABLE_CODE_POINTS = /[\u00ad\u034f\u061c\u115f-\u1160\u17b4-\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufffb\u{1bca0}-\u{1bca3}\u{1d173}-\u{1d17a}\u{e0000}-\u{e0fff}]/gu;
const tesseractVariants = ["core", "core-lstm", "core-relaxedsimd", "core-relaxedsimd-lstm", "core-simd", "core-simd-lstm"];
const reviewedEmscriptenTextEntries = new Set([
  "features/music.js",
  "worker.js",
  "ort/ort-wasm-simd-threaded.jsep.mjs",
  ...tesseractVariants.flatMap((variant) => [
    `ocr/core/tesseract-${variant}.js`,
    `ocr/core/tesseract-${variant}.wasm.js`,
  ]),
]);
const reviewedRuntimeEntries = new Set([
  ...reviewedEmscriptenTextEntries,
  "ort/ort-wasm-simd-threaded.jsep.wasm",
  ...tesseractVariants.map((variant) => `ocr/core/tesseract-${variant}.wasm`),
]);
const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await withReleaseArtifactLock("verify Remilia migration release artifacts", async () => {
    const first = await scanArchives();
    const second = await scanArchives();
    const firstText = `${JSON.stringify(first, null, 2)}\n`;
    const secondText = `${JSON.stringify(second, null, 2)}\n`;
    if (firstText !== secondText) throw new Error("Remilia migration artifact scan report is not reproducible");
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, firstText, "utf8");
    console.log(`Remilia migration artifact scan passed: ${first.reportSha256}`);
    console.log(`Report: ${reportPath}`);
  });
}

async function scanArchives() {
  const archives = [];
  for (const build of [...releaseBuilds].sort((a, b) => a.target.localeCompare(b.target))) {
    const path = `release/milXdy-${version}-${build.target}.zip`;
    const archive = await readFile(path);
    const files = [];
    const entries = listZipEntries(archive).sort((a, b) => a.fileName.localeCompare(b.fileName));
    for (const entry of entries) {
      const content = readZipEntry(archive, entry);
      scanContent(path, entry.fileName, content);
      files.push({
        path: entry.fileName,
        bytes: content.length,
        sha256: sha256(content),
      });
    }
    archives.push({
      target: build.target,
      path,
      bytes: archive.length,
      sha256: sha256(archive),
      files,
    });
  }
  const report = { schemaVersion: 1, release: version, archives };
  return { ...report, reportSha256: sha256(Buffer.from(JSON.stringify(report))) };
}

export function scanContent(archivePath, entryName, content) {
  if (isReviewedRuntimeLookalike(entryName)) {
    throw new Error(`${archivePath}:${entryName}: unreviewed runtime lookalike detected`);
  }
  if (!isTextCandidate(entryName, content)) return;
  const text = content.toString("utf8");
  assertRequiredMigrationRuntimeContracts(archivePath, entryName, text);
  let normalizedText;
  try {
    normalizedText = normalizeAnchorVisibleText(text);
  } catch {
    throw new Error(`${archivePath}:${entryName}: malformed anchor text detected`);
  }
  assertNoRetiredSessionUi(archivePath, entryName, normalizedText);
  assertNoAmbiguousRemiliaNavigation(archivePath, entryName, text);
  const scanText = maskAllowedContent(entryName, text);
  const prohibited = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "private key"],
    [/(?:^|[^A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}(?:$|[^A-Za-z0-9_-])/i, "JWT-like credential"],
    [/Authorization:\s*Bearer\s+(?!<|\$|\{|YOUR_|ACCESS_TOKEN)[A-Za-z0-9._~-]{12,}/i, "bearer credential"],
    [/(?:REMILIA_CLIENT_SECRET|CLIENT_SECRET)\s*=\s*["']?[A-Za-z0-9._~-]{8,}/i, "client secret assignment"],
    [/(?:^|[\s"'`(=])[A-Za-z]:[\\/]/, "Windows machine path"],
    [/\\\\[^\\/\s]+\\[^\\/\s]+(?:\\|$)/, "UNC machine path"],
    [/\bfile:\/\/(?:\/?[A-Za-z]:[\\/]|\/(?:Users|home)\/[^/\s]+\/|\/~[\\/]|[^/"'`\s]+\/[^/"'`\s]+(?:[\\/]|$))/i, "file URL"],
    [/(?:^|[\s"'`(=])~[\\/][^\\/\s]+(?:[\\/]|$)/, "user-home path"],
    [/\/Users\/[^/\s]+/, "macOS machine path"],
    [/\/home\/[^/\s]+/, "Linux machine path"],
    [/(?:^|[\\/])\.codex[\\/]worktrees[\\/]/i, "Codex worktree path"],
    [/(?<![A-Za-z0-9_-])beetol-retry-session(?![A-Za-z0-9_-])/i, "retired Beetol retry-session UI"],
    [/beetol:(?:logout|sessionStatus)\b/i, "retired Beetol auth operation"],
    [/Sign in[^.\n<>]{0,120}RemiliaNET[^.\n<>]{0,120}(?:return|retry)[^.\n<>]{0,120}Beetol|RemiliaNET[^.\n<>]{0,120}(?:return|retry)[^.\n<>]{0,120}Beetol/i, "retired Beetol website-sign-in instruction"],
    [/\bOpen RemiliaNET\b/i, "retired browser-session UI"],
  ];
  for (const [pattern, label] of prohibited) {
    if (pattern.test(scanText)) throw new Error(`${archivePath}:${entryName}: ${label} detected`);
  }
}

function assertRequiredMigrationRuntimeContracts(archivePath, entryName, text) {
  if (!/(?:^|[\\/])milXdy-0\.2\.5-(?:chromium|firefox)\.zip$/i.test(archivePath)) return;
  if (entryName === "features/beetol.js") {
    requireArtifactText(archivePath, entryName, text, "Open the milXdy extension popup, then use Remilia connection &rarr; Connect/Reconnect.", "passive popup guidance");
    requireArtifactText(archivePath, entryName, text, "beetol:authStatus", "token-free auth-status operation");
    requireArtifactText(archivePath, entryName, text, "Official read-only status", "read-only Beetle status label");
    requireArtifactText(archivePath, entryName, text, "Play Beetle on RemiliaNET", "visible native Beetle navigation");
    requireArtifactText(archivePath, entryName, text, "cartridge=beetle", "visible native Beetle cartridge route");
    requireArtifactText(archivePath, entryName, text, "noopener noreferrer", "opener-safe native Beetle navigation");
    if (/remilia-auth:/i.test(text)) {
      throw new Error(`${archivePath}:${entryName}: direct Remilia auth operation detected in Beetol content`);
    }
    if (/beetol:(?:action|crunchJunk)|data-action|Use the visible RemiliaNET Beetle control/i.test(text)) {
      throw new Error(`${archivePath}:${entryName}: action-looking or circular Beetol content interaction detected`);
    }
  }
  if (entryName === "background.js") {
    const beetolModule = extractBundledAppModule(archivePath, entryName, text, "src/apps/beetol/background.js");
    requireArtifactText(archivePath, entryName, beetolModule, "beetol:authStatus", "Beetol auth-status registration");
    requireArtifactText(archivePath, entryName, beetolModule, "official-api", "official Beetle read mode");
    requireArtifactText(archivePath, entryName, beetolModule, "NATIVE_ACTION_REQUIRED", "bounded native-action result");
    requireArtifactText(archivePath, entryName, beetolModule, "native-remilianet", "native RemiliaNET action mode");
    const prohibitedNativeTransport = /\/api\/beetle\/action\/|Authorization|fetch\s*\(|prepareRemiliaAccess|refreshRemiliaAccess|credentials:\s*["']include["']|chrome\.tabs\.create|chrome\.windows\.create|disconnectRemiliaAuth|clearRemiliaAuth/;
    if (prohibitedNativeTransport.test(beetolModule)) {
      throw new Error(`${archivePath}:${entryName}: Beetol native-action transport or auth-custody residue detected`);
    }
  }
  if (entryName === "reminetChatBridge.js") {
    requireArtifactText(archivePath, entryName, text, "beetol:authStatus", "token-free connector status polling");
    requireArtifactText(archivePath, entryName, text, "isTrusted", "trusted native Beetle click check");
    requireArtifactText(archivePath, entryName, text, "data-milxdy-reminet-beetle-native-acceleration", "native Beetle presentation acceleration");
    requireArtifactText(archivePath, entryName, text, "milxdy-reminet-beetle-native-status", "bounded native Beetle status");
    requireArtifactText(archivePath, entryName, text, "0.001ms", "lifecycle-safe native Beetle acceleration duration");
    if (/beetol:action|remilia-auth:|\.preventDefault\(|\.stopImmediatePropagation\(|\/api\/beetle\/action\//i.test(text)) {
      throw new Error(`${archivePath}:${entryName}: intercepted or proxied RemiliaNET Beetle action detected`);
    }
  }
  if (entryName === "features/post-reading.js") {
    const directFetch = /const\s+response\d*\s*=\s*await\s+fetch\(url,\s*\{\s*credentials:\s*"omit",\s*redirect:\s*"error",\s*referrerPolicy:\s*"no-referrer",\s*signal\s*,?\s*\}\);\s*if\s*\(!response\d*\.ok\)\s*throw\s+new\s+Error\(`Text fetch failed: \$\{response\d*\.status\}`\);\s*return\s+await\s+response\d*\.text\(\);/;
    if (!directFetch.test(text)) {
      throw new Error(`${archivePath}:${entryName}: direct full-quote omit/error/no-referrer/status/text contract missing`);
    }
  }
}

function extractBundledAppModule(archivePath, entryName, text, sourcePath) {
  const marker = `// ${sourcePath}`;
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`${archivePath}:${entryName}: ${sourcePath} module boundary missing`);
  }
  const remainder = text.slice(markerIndex + marker.length);
  const nextAppModule = /(?:\r?\n)[ \t]*\/\/ src\/apps\/(?!beetol\/)[^\r\n]+/.exec(remainder);
  if (!nextAppModule) {
    throw new Error(`${archivePath}:${entryName}: ${sourcePath} next module boundary missing`);
  }
  return text.slice(markerIndex, markerIndex + marker.length + nextAppModule.index);
}

function requireArtifactText(archivePath, entryName, text, required, label) {
  if (!text.includes(required)) throw new Error(`${archivePath}:${entryName}: ${label} missing`);
}

function assertNoRetiredSessionUi(archivePath, entryName, text) {
  const clause = String.raw`[^.;!?\n<>\u2028\u2029]`;
  const safePatterns = [
    String.raw`\bbrowser-session authentication is (?:removed|disabled|retired|unsupported)\b`,
    String.raw`\b(?:removes?|deletes?)\b${clause}{0,100}\bbrowser-session login (?:data|state)\b`,
    String.raw`\bbrowser-session login (?:data|state)\b${clause}{0,80}\b(?:must be|is|was) (?:deleted|removed|disabled|retired|unsupported)\b`,
    String.raw`\bdoes not\b${clause}{0,40}\b(?:reuse|adopt|detect|restore|refresh)\b${clause}{0,140}\b(?:browser[- ]session|RemiliaNET\s+(?:browser\s+)?session)\b`,
    String.raw`\bno (?:browser[- ]session|RemiliaNET\s+(?:browser\s+)?session)\b${clause}{0,60}\bwill (?:be )?(?:reused|adopted|detected|restored|refreshed)\b`,
    String.raw`\b(?:does not|do not|never|no longer)\b${clause}{0,180}\b(?:browser[- ]session|RemiliaNET\s+(?:browser\s+)?session)\b${clause}{0,100}\b(?:sign[- ]?in|log[- ]?in)\b`,
    String.raw`\b(?:does not|do not|never|no longer)\b${clause}{0,180}\b(?:sign[- ]?in|log[- ]?in)\b${clause}{0,100}\b(?:browser[- ]session|RemiliaNET\s+(?:browser\s+)?session)\b`,
    String.raw`\b(?:browser[- ]session|RemiliaNET\s+(?:browser\s+)?session)\b${clause}{0,100}\b(?:sign[- ]?in|log[- ]?in)\b${clause}{0,60}\b(?:is|was|has been) (?:removed|deleted|disabled|retired|unsupported)\b`,
    String.raw`\b(?:sign[- ]?in|log[- ]?in)\b${clause}{0,100}\b(?:browser[- ]session|RemiliaNET\s+(?:browser\s+)?session)\b${clause}{0,60}\b(?:is|was|has been) (?:removed|deleted|disabled|retired|unsupported)\b`,
    String.raw`\b(?:does not|do not|never|no longer)\b${clause}{0,180}\b(?:sign[- ]?in|log[- ]?in)\b${clause}{0,80}\b(?:on|through|with)\s+RemiliaNET\b${clause}{0,120}\b(?:return|back)\b${clause}{0,120}\b(?:milXdy|session)\b`,
  ];
  const safeSessionExplanations = safePatterns.reduce(
    (value, pattern) => value.replace(new RegExp(pattern, "gi"), "<safe-session-explanation>"),
    text,
  );
  const retired = [
    /\bRetry session\b/i,
    /(?<![A-Za-z0-9_-])retry-session(?![A-Za-z0-9_-])/i,
    /\b(?:browser[- ]session|RemiliaNET\s+(?:browser\s+)?session)\b[^.\n<>]{0,140}\b(?:auth(?:entication)?|login|sign[- ]?in|log[- ]?in|reuse[ds]?|adopt(?:ion|s|ed)?|detect(?:ion|s|ed)?|restore[ds]?|refresh(?:es|ed)?)\b/i,
    /\b(?:sign[- ]?in|log[- ]?in|reuse[ds]?|adopt(?:s|ed)?|detect(?:s|ed)?|restore[ds]?|refresh(?:es|ed)?)\b[^.\n<>]{0,140}\b(?:existing\s+)?(?:browser[- ]session|RemiliaNET\s+(?:browser\s+)?session)\b/i,
    /\b(?:sign[- ]?in|log[- ]?in)\b[^.\n<>]{0,80}\b(?:on|through|with)\s+RemiliaNET\b[^.\n<>]{0,120}\b(?:return|back)\b[^.\n<>]{0,120}\b(?:milXdy|(?:existing\s+)?session)\b/i,
    /\bRemiliaNET\b[^.\n<>]{0,120}\b(?:authToken\s+cookie|cookie\s+(?:login|authentication|session|reuse))\b/i,
    /\b(?:background|hidden|inactive)\s+tab\b[^.\n<>]{0,100}\b(?:session|login|authentication)\b/i,
    /\bOpen RemiliaNET\b[^.\n<>]{0,120}\b(?:background|hidden|inactive)\s+tab\b/i,
    /\bOpen RemiliaNET\b[^.\n<>]{0,160}\b(?:retry|reuse|restore|detect|adopt|sign[- ]?in|log[- ]?in)\b[^.\n<>]{0,100}\b(?:session|login|authentication)\b/i,
  ];
  if (retired.some((pattern) => pattern.test(safeSessionExplanations))) {
    throw new Error(`${archivePath}:${entryName}: retired browser-session UI detected`);
  }
}

function maskAllowedContent(entryName, text) {
  const allowedLabel = "<allowed-remilia-navigation>";
  let masked = text
    .replaceAll("Open RemiliaNET Chat in milXdy", allowedLabel)
    .replaceAll("Open RemiliaNET profile", allowedLabel);
  masked = maskReviewedEmscriptenPaths(entryName, masked);
  const matches = findAnchors(masked);
  const replacements = [];
  for (const match of matches) {
    if (match.text !== "Open RemiliaNET") continue;
    const index = match.index;
    const openingTag = match.openingTag;
    const hrefs = parseAnchorAttributes(openingTag).filter((attribute) => attribute.name === "href");
    const officialHref = hrefs.length === 1
      && hrefs[0].quoted
      && hrefs[0].value === "https://www.remilia.net/";
    const context = masked.slice(Math.max(0, index - 500), Math.min(masked.length, index + 500));
    const currentRecovery = /(?:retry-connection|Reconnect Chat)/i.test(context)
      && /(?:Remilia Chat authorization|authorization is required|Checking Remilia Chat authorization|\bConnect\b|\bReconnect\b)/i.test(context);
    if (officialHref && currentRecovery) {
      replacements.push({
        start: index,
        end: match.end,
        value: `${openingTag}${allowedLabel}${match.closingTag}`,
      });
    }
  }
  return replaceIntervals(masked, replacements);
}

function replaceIntervals(text, replacements) {
  if (replacements.length === 0) return text;
  const chunks = [];
  let cursor = 0;
  for (const replacement of replacements) {
    if (replacement.start < cursor || replacement.end < replacement.start || replacement.end > text.length) {
      throw new Error("overlapping or invalid replacement interval");
    }
    chunks.push(text.slice(cursor, replacement.start), replacement.value);
    cursor = replacement.end;
  }
  chunks.push(text.slice(cursor));
  return chunks.join("");
}

function maskReviewedEmscriptenPaths(entryName, text) {
  if (!reviewedEmscriptenTextEntries.has(entryName)) return text;
  const candidates = [];
  const placeholder = "/home/web_user";
  for (let pathIndex = text.indexOf(placeholder); pathIndex !== -1; pathIndex = text.indexOf(placeholder, pathIndex + placeholder.length)) {
    if (candidates.length >= MAX_EMSCRIPTEN_PATH_CANDIDATES) throw new Error(`${entryName}: Emscripten path candidate limit exceeded`);
    const contextStart = Math.max(0, pathIndex - 260);
    const prefix = text.slice(contextStart, pathIndex);
    const suffix = text.slice(pathIndex + placeholder.length);
    const environment = prefix.match(/(?:^|[{,])\s*USER\s*:\s*"web_user"\s*,\s*LOGNAME\s*:\s*"web_user"\s*,\s*PATH\s*:\s*"\/"\s*,\s*PWD\s*:\s*"\/"\s*,\s*HOME\s*:\s*"$/);
    if (environment && /^"(?=\s*[,};)\]])/.test(suffix)) {
      candidates.push({
        codeIndex: contextStart + environment.index + environment[0].indexOf("USER"),
        start: pathIndex,
        end: pathIndex + placeholder.length,
      });
      continue;
    }
    const virtualDirectory = prefix.match(/([A-Za-z_$][\w$]*)\.mkdir\("\/home"\)\s*;\s*\1\.mkdir\("$/);
    if (virtualDirectory && /^"(?=\s*\))/.test(suffix)) {
      candidates.push({
        codeIndex: contextStart + virtualDirectory.index,
        start: pathIndex,
        end: pathIndex + placeholder.length,
      });
    }
  }
  const { codeOffsets, malformedTemplate } = findJavaScriptCodeOffsets(text, candidates.map((candidate) => candidate.codeIndex));
  if (malformedTemplate) throw new Error(`${entryName}: malformed JavaScript template nesting`);
  const ranges = candidates
    .filter((candidate) => codeOffsets.has(candidate.codeIndex))
    .map(({ start, end }) => [start, end])
    .sort((a, b) => a[0] - b[0]);
  if (ranges.length > 0) {
    const parts = [];
    let cursor = 0;
    for (const [start, end] of ranges) {
      parts.push(text.slice(cursor, start), "<emscripten-home>");
      cursor = end;
    }
    parts.push(text.slice(cursor));
    text = parts.join("");
  }
  return text;
}

function isReviewedRuntimeLookalike(entryName) {
  const normalized = entryName.replace(/\\/g, "/").toLowerCase();
  const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
  const reviewedPrefix = basename.startsWith("ort-wasm-")
    || basename.startsWith("tesseract-core");
  return reviewedPrefix && !reviewedRuntimeEntries.has(entryName);
}

function findJavaScriptCodeOffsets(text, offsets) {
  const targets = new Set(offsets);
  const codeOffsets = new Set();
  let state = "code";
  let regexCharacterClass = false;
  let previousSignificant = "";
  const templateExpressionDepths = [];
  for (let index = 0; index < text.length; index += 1) {
    if (targets.has(index) && state === "code") codeOffsets.add(index);
    const character = text[index];
    const next = text[index + 1];
    if (state === "line-comment") {
      if (character === "\n" || character === "\r" || character === "\u2028" || character === "\u2029") state = "code";
    } else if (state === "block-comment") {
      if (character === "*" && next === "/") {
        state = "code";
        index += 1;
      }
    } else if (state === "single-quote" || state === "double-quote") {
      if (character === "\\") index += 1;
      else if ((state === "single-quote" && character === "'")
        || (state === "double-quote" && character === '"')) state = "code";
    } else if (state === "template") {
      if (character === "\\") index += 1;
      else if (character === "`") state = "code";
      else if (character === "$" && next === "{") {
        templateExpressionDepths.push(1);
        state = "code";
        previousSignificant = "{";
        index += 1;
      }
    } else if (state === "regex") {
      if (character === "\\") index += 1;
      else if (character === "[") regexCharacterClass = true;
      else if (character === "]") regexCharacterClass = false;
      else if (character === "/" && !regexCharacterClass) {
        state = "code";
        while (isAsciiLetter(text[index + 1])) index += 1;
        previousSignificant = "/";
      }
    } else if (character === "/" && next === "/") {
      state = "line-comment";
      index += 1;
    } else if (character === "/" && next === "*") {
      state = "block-comment";
      index += 1;
    } else if (character === "/" && canStartJavaScriptRegex(previousSignificant)) {
      state = "regex";
      regexCharacterClass = false;
    } else if (character === "'") state = "single-quote";
    else if (character === '"') state = "double-quote";
    else if (character === "`") state = "template";
    else if (templateExpressionDepths.length > 0 && character === "{") {
      templateExpressionDepths[templateExpressionDepths.length - 1] += 1;
      previousSignificant = character;
    } else if (templateExpressionDepths.length > 0 && character === "}") {
      const last = templateExpressionDepths.length - 1;
      templateExpressionDepths[last] -= 1;
      if (templateExpressionDepths[last] === 0) {
        templateExpressionDepths.pop();
        state = "template";
      }
      previousSignificant = character;
    }
    else if (!isJavaScriptWhitespace(character)) previousSignificant = character;
  }
  return {
    codeOffsets,
    malformedTemplate: state === "template" || templateExpressionDepths.length > 0,
  };
}

function canStartJavaScriptRegex(previousSignificant) {
  return previousSignificant === "" || "({[=,:;!?&|+*%~<>-".includes(previousSignificant);
}

function isAsciiLetter(value) {
  if (!value) return false;
  const code = value.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isJavaScriptWhitespace(value) {
  return value === " " || value === "\t" || value === "\n" || value === "\r" || value === "\f" || value === "\v" || value === "\u00a0";
}

function assertNoAmbiguousRemiliaNavigation(archivePath, entryName, text) {
  const entityBudget = { count: 0 };
  for (const anchor of findAnchors(text)) {
    let visibleText;
    try {
      visibleText = decodeVisibleAnchorText(anchor.text, entityBudget);
    } catch {
      throw new Error(`${archivePath}:${entryName}: malformed anchor text detected`);
    }
    if (/^Open RemiliaNET$/i.test(visibleText) && anchor.text !== "Open RemiliaNET") {
      throw new Error(`${archivePath}:${entryName}: retired browser-session UI detected`);
    }
  }
}

function normalizeAnchorVisibleText(text) {
  const anchors = findAnchors(text);
  const chunks = [];
  const entityBudget = { count: 0 };
  let cursor = 0;
  for (const anchor of anchors) {
    if (anchor.index < cursor || anchor.end < anchor.index || anchor.end > text.length) {
      throw new Error("overlapping or invalid anchor interval");
    }
    chunks.push(
      text.slice(cursor, anchor.index),
      anchor.openingTag,
      decodeVisibleAnchorText(anchor.text, entityBudget),
      anchor.closingTag,
    );
    cursor = anchor.end;
  }
  chunks.push(text.slice(cursor));
  return chunks.join("");
}

function decodeVisibleAnchorText(value, globalBudget = { count: 0 }) {
  const namedWhitespace = new Map([
    ["nbsp", "\u00a0"], ["NonBreakingSpace", "\u00a0"], ["Tab", "\t"], ["NewLine", "\n"],
    ["ensp", "\u2002"], ["emsp", "\u2003"], ["emsp13", "\u2004"], ["emsp14", "\u2005"],
    ["numsp", "\u2007"], ["puncsp", "\u2008"], ["thinsp", "\u2009"], ["ThinSpace", "\u2009"],
    ["hairsp", "\u200a"], ["VeryThinSpace", "\u200a"], ["MediumSpace", "\u205f"], ["ThickSpace", "\u205f\u200a"],
    ["ZeroWidthSpace", "\u200b"],
    ["NegativeThinSpace", "\u200b"], ["NegativeMediumSpace", "\u200b"],
    ["NegativeThickSpace", "\u200b"], ["NegativeVeryThinSpace", "\u200b"],
    ["zwnj", "\u200c"], ["zwj", "\u200d"], ["lrm", "\u200e"], ["rlm", "\u200f"],
    ["shy", "\u00ad"],
    ["NoBreak", "\u2060"], ["ApplyFunction", "\u2061"], ["af", "\u2061"],
    ["InvisibleTimes", "\u2062"], ["it", "\u2062"], ["InvisibleComma", "\u2063"], ["ic", "\u2063"],
  ]);
  const withoutMarkup = value.replace(/<[^>]*>/g, "");
  let decoded = "";
  let entityCount = 0;
  for (let index = 0; index < withoutMarkup.length; index += 1) {
    if (withoutMarkup[index] !== "&") {
      decoded += withoutMarkup[index];
      continue;
    }
    entityCount += 1;
    if (entityCount > MAX_ANCHOR_ENTITIES) throw new Error("too many HTML entities");
    globalBudget.count += 1;
    if (globalBudget.count > MAX_TOTAL_ANCHOR_ENTITIES) throw new Error("global HTML entity limit exceeded");
    if (withoutMarkup[index + 1] === "#") {
      const hexadecimal = withoutMarkup[index + 2] === "x" || withoutMarkup[index + 2] === "X";
      const digitStart = index + (hexadecimal ? 3 : 2);
      let digitEnd = digitStart;
      const digitPattern = hexadecimal ? /[0-9a-f]/i : /[0-9]/;
      while (digitEnd < withoutMarkup.length && digitPattern.test(withoutMarkup[digitEnd])) digitEnd += 1;
      const digits = withoutMarkup.slice(digitStart, digitEnd);
      if (!digits || digits.length > MAX_NUMERIC_ENTITY_DIGITS || withoutMarkup[digitEnd] !== ";") {
        throw new Error("invalid numeric HTML entity");
      }
      decoded += decodeNumericEntity(Number.parseInt(digits, hexadecimal ? 16 : 10));
      index = digitEnd;
      continue;
    }
    let nameEnd = index + 1;
    while (nameEnd < withoutMarkup.length && /[A-Za-z0-9]/.test(withoutMarkup[nameEnd])) nameEnd += 1;
    const name = withoutMarkup.slice(index + 1, nameEnd);
    if (name.length > MAX_ENTITY_NAME_LENGTH) throw new Error("HTML entity name too long");
    if (name && withoutMarkup[nameEnd] === ";") {
      decoded += namedWhitespace.get(name) ?? withoutMarkup.slice(index, nameEnd + 1);
      index = nameEnd;
      continue;
    }
    decoded += "&";
  }
  return decoded
    .replace(DEFAULT_IGNORABLE_CODE_POINTS, "")
    .replace(/[\s\u00a0\u2002-\u200b\u205f]+/g, " ")
    .trim();
}

function decodeNumericEntity(codePoint) {
  if (!Number.isInteger(codePoint)
    || codePoint < 0
    || codePoint > 0x10ffff
    || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
    throw new Error("invalid numeric HTML entity");
  }
  return String.fromCodePoint(codePoint);
}

function findAnchors(text) {
  const anchors = [];
  const lower = text.toLowerCase();
  const startPattern = /<a(?=[\t\n\f\r >])/gi;
  for (let start = startPattern.exec(text); start; start = startPattern.exec(text)) {
    let quote = "";
    let openingEnd = -1;
    for (let index = start.index + 2; index < text.length; index += 1) {
      const character = text[index];
      if (quote) {
        if (character === quote) quote = "";
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        openingEnd = index + 1;
        break;
      }
    }
    if (openingEnd === -1) continue;
    const closingStart = lower.indexOf("</a>", openingEnd);
    if (closingStart === -1) continue;
    anchors.push({
      index: start.index,
      openingTag: text.slice(start.index, openingEnd),
      text: text.slice(openingEnd, closingStart),
      closingTag: text.slice(closingStart, closingStart + 4),
      end: closingStart + 4,
    });
    if (anchors.length > MAX_ANCHORS) throw new Error("anchor count limit exceeded");
    startPattern.lastIndex = closingStart + 4;
  }
  return anchors;
}

function parseAnchorAttributes(openingTag) {
  const attributes = [];
  let index = 2;
  while (index < openingTag.length - 1) {
    while (/[\t\n\f\r ]/.test(openingTag[index])) index += 1;
    if (index >= openingTag.length - 1 || openingTag[index] === ">") break;
    if (openingTag[index] === "/") {
      index += 1;
      continue;
    }
    const nameStart = index;
    while (index < openingTag.length && !/[\t\n\f\r =>/]/.test(openingTag[index])) index += 1;
    const name = openingTag.slice(nameStart, index).toLowerCase();
    while (/[\t\n\f\r ]/.test(openingTag[index])) index += 1;
    if (openingTag[index] !== "=") {
      attributes.push({ name, quoted: false, value: "" });
      continue;
    }
    index += 1;
    while (/[\t\n\f\r ]/.test(openingTag[index])) index += 1;
    const delimiter = openingTag[index];
    if (delimiter === '"' || delimiter === "'") {
      index += 1;
      const valueStart = index;
      while (index < openingTag.length && openingTag[index] !== delimiter) index += 1;
      attributes.push({ name, quoted: true, value: openingTag.slice(valueStart, index) });
      if (openingTag[index] === delimiter) index += 1;
    } else {
      const valueStart = index;
      while (index < openingTag.length && !/[\t\n\f\r >]/.test(openingTag[index])) index += 1;
      attributes.push({ name, quoted: false, value: openingTag.slice(valueStart, index) });
    }
  }
  return attributes;
}

function isTextCandidate(fileName, content) {
  if (content.length > MAX_TEXT_SCAN_BYTES || content.includes(0)) return false;
  return /(?:^|\/)(?:[^/]+\.(?:css|csv|html|js|json|md|mjs|svg|txt|xml)|LICENSE|NOTICE)$/i.test(fileName);
}

export function readZipEntry(zip, entry) {
  const compressed = zip.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  let content;
  if (entry.compressionMethod === 0) content = Buffer.from(compressed);
  else if (entry.compressionMethod === 8) content = inflateRawSync(compressed, { maxOutputLength: MAX_ARCHIVE_ENTRY_BYTES });
  else throw new Error(`${entry.fileName}: unsupported ZIP compression method ${entry.compressionMethod}`);
  if (content.length !== entry.uncompressedSize) throw new Error(`${entry.fileName}: ZIP uncompressed size mismatch`);
  if (crc32(content) !== entry.crc32) throw new Error(`${entry.fileName}: ZIP CRC mismatch`);
  return content;
}

export function listZipEntries(zip) {
  const eocdOffset = findEndOfCentralDirectory(zip);
  if (zip.readUInt16LE(eocdOffset + 4) !== 0 || zip.readUInt16LE(eocdOffset + 6) !== 0) {
    throw new Error("Multi-disk ZIP archives are unsupported");
  }
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  if (entryCount !== zip.readUInt16LE(eocdOffset + 8)) throw new Error("ZIP entry count mismatch");
  const directorySize = zip.readUInt32LE(eocdOffset + 12);
  const directoryOffset = zip.readUInt32LE(eocdOffset + 16);
  if (directoryOffset + directorySize !== eocdOffset) throw new Error("Invalid ZIP central directory bounds");
  let offset = directoryOffset;
  const entries = [];
  const names = new Set();
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocdOffset) throw new Error("Truncated ZIP central directory");
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid ZIP central directory");
    const flags = zip.readUInt16LE(offset + 8);
    if (flags & 0x0001) throw new Error("Encrypted ZIP entries are unsupported");
    const compressionMethod = zip.readUInt16LE(offset + 10);
    const crc32Value = zip.readUInt32LE(offset + 16);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    if (uncompressedSize > MAX_ARCHIVE_ENTRY_BYTES) throw new Error("ZIP entry exceeds scan size limit");
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + fileNameLength + extraLength + commentLength;
    if (nextOffset > eocdOffset) throw new Error("Truncated ZIP central directory entry");
    const fileName = zip.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8").replace(/\\/g, "/");
    validateEntryName(fileName);
    if (names.has(fileName)) throw new Error(`${fileName}: duplicate ZIP entry`);
    names.add(fileName);
    if (!fileName.endsWith("/")) {
      if (localHeaderOffset + 30 > directoryOffset) throw new Error(`${fileName}: invalid ZIP local header bounds`);
      if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error(`${fileName}: invalid ZIP local header`);
      if (zip.readUInt16LE(localHeaderOffset + 6) !== flags) throw new Error(`${fileName}: ZIP flag mismatch`);
      if (zip.readUInt16LE(localHeaderOffset + 8) !== compressionMethod) throw new Error(`${fileName}: ZIP compression mismatch`);
      const localNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
      const localName = zip.subarray(localHeaderOffset + 30, localHeaderOffset + 30 + localNameLength).toString("utf8").replace(/\\/g, "/");
      if (localName !== fileName) throw new Error(`${fileName}: ZIP local/central name mismatch`);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      if (dataOffset + compressedSize > directoryOffset) throw new Error(`${fileName}: ZIP data exceeds local-file bounds`);
      entries.push({
        fileName,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        crc32: crc32Value,
        dataOffset,
      });
    }
    offset = nextOffset;
  }
  if (offset !== eocdOffset) throw new Error("ZIP central directory size mismatch");
  return entries;
}

function validateEntryName(fileName) {
  if (!fileName || fileName.startsWith("/") || /^[A-Za-z]:\//.test(fileName)) {
    throw new Error(`${fileName || "<empty>"}: unsafe ZIP entry path`);
  }
  const segments = fileName.endsWith("/") ? fileName.slice(0, -1).split("/") : fileName.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${fileName}: unsafe ZIP entry path`);
  }
}

function findEndOfCentralDirectory(zip) {
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65_557); offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP end-of-central-directory record not found");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
