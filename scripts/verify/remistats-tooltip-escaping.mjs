import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("src/apps/remistats/content.js", "utf8");
const failures = [];

assertIncludes(source, "followers: nonNegativeNumber(apiUser.friendCount)", "RemiStats API friendCount must be normalized before tooltip rendering");
assertIncludes(source, "const followerLabel = formatMetric(scoreData.followers);", "RemiStats tooltip must preformat followers through metric normalization");
assertIncludes(source, "<span>${followerLabel} friends</span>", "RemiStats tooltip footer must render the normalized follower label");
assertNotIncludes(source, "scoreData.followers?.toLocaleString()", "RemiStats tooltip must not call toLocaleString on remote follower values");

const context = {};
vm.createContext(context);
vm.runInContext([
  functionDeclaration("escapeHtml"),
  functionDeclaration("finiteNumber"),
  functionDeclaration("nonNegativeNumber"),
  functionDeclaration("formatMetric"),
  functionDeclaration("cleanUsername"),
  functionDeclaration("transformApiResponse"),
  "globalThis.transformApiResponse = transformApiResponse;",
].join("\n"), context);

const hostileApiUser = {
  username: "remiUser<script>",
  twitterHandle: "xHandle<img src=x onerror=alert(1)>",
  displayName: "<img src=x onerror=alert(1)>",
  socialCreditScore: "<svg/onload=alert(2)>",
  beetles: "<script>alert(3)</script>",
  friendCount: "<img src=x onerror=alert(4)>",
  pfpProject: `Milady" onerror="alert(5)`,
  pfpId: `7"><script>alert(6)</script>`,
};

const transformed = context.transformApiResponse(hostileApiUser, "fallback");
assertEqual(transformed.followers, 0, "Hostile RemiStats friendCount must normalize to zero");
assertEqual(transformed.score, hostileApiUser.socialCreditScore, "Verifier should use hostile score values before render-time metric normalization");
assertEqual(transformed.beetleCount, hostileApiUser.beetles, "Verifier should use hostile beetle values before render-time metric normalization");
assertEqual(transformed.displayName, hostileApiUser.displayName, "Verifier should use hostile display names before tooltip escaping");
assertEqual(transformed.pfpProject, hostileApiUser.pfpProject, "Verifier should use hostile PFP projects before URL encoding");
assertEqual(transformed.pfpId, hostileApiUser.pfpId, "Verifier should use hostile PFP ids before URL encoding");

const numericApiUser = { ...hostileApiUser, friendCount: "42.5" };
assertEqual(context.transformApiResponse(numericApiUser, "fallback").followers, 42.5, "Numeric RemiStats friendCount strings should remain usable metrics");

if (failures.length > 0) {
  console.error(`RemiStats tooltip escaping verification failed: ${failures.length}`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("RemiStats tooltip escaping verification passed.");

function functionDeclaration(name) {
  const start = findFunctionDeclaration(source, name);
  if (start < 0) fail(`missing function: ${name}`);
  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) fail(`missing opening brace for: ${name}`);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  fail(`missing closing brace for: ${name}`);
  return "";
}

function findFunctionDeclaration(input, name) {
  const pattern = new RegExp(`function\\s+${escapeRegExp(name)}\\s*\\(`, "m");
  const match = pattern.exec(input);
  return match ? match.index : -1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertIncludes(input, needle, message) {
  if (!input.includes(needle)) fail(message);
}

function assertNotIncludes(input, needle, message) {
  if (input.includes(needle)) fail(message);
}

function assertEqual(actual, expected, message) {
  if (!Object.is(actual, expected)) fail(`${message} (expected ${expected}, got ${actual})`);
}

function fail(message) {
  failures.push(message);
}
