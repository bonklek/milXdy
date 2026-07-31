import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  candidateRoot,
  invariant,
  isDirectExecution,
  listFiles,
  relativeFromCandidate,
} from "./lib.mjs";

const textExtensions = new Set([
  "",
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".svg",
  ".txt",
]);

const forbidden = [
  { label: "Windows user path", pattern: /[A-Za-z]:[\\/]+Users[\\/]+/i },
  { label: "UNC user path", pattern: /\\\\[^\\]+\\Users\\/i },
  { label: "Codex private state", pattern: /(?:^|[/\\])\.codex(?:[/\\]|$)/i },
  { label: "private release ledger", pattern: new RegExp(["release", "ledgers"].join("-"), "i") },
  { label: "private audit path", pattern: /planning[/\\]audits/i },
  { label: "developer documents path", pattern: /Documents[/\\]dev/i },
  { label: "file URI", pattern: /file:\/\//i },
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { label: "GitHub token", pattern: /\bgh[opsu]_[A-Za-z0-9_]{20,}\b/ },
  { label: "authorization bearer", pattern: /\bAuthorization:\s*Bearer\s+\S+/i },
  { label: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
];

export async function checkPathLeaks() {
  const files = (await listFiles(candidateRoot)).filter((file) =>
    textExtensions.has(path.extname(file).toLowerCase())
  );
  const errors = [];

  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const rule of forbidden) {
      if (rule.pattern.test(text)) errors.push(`${relativeFromCandidate(file)}: ${rule.label}`);
    }
  }

  invariant(errors.length === 0, `Private path/secret leak check failed:\n${errors.join("\n")}`);
  return { files: files.length, rules: forbidden.length };
}

if (isDirectExecution(import.meta.url)) {
  const summary = await checkPathLeaks();
  console.log(`Checked ${summary.files} text files against ${summary.rules} private-path/secret rules.`);
}
