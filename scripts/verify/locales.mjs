import { readdir, readFile } from "node:fs/promises";

const manifestPath = "assets/extension/manifest.json";
const localesRoot = "assets/extension/_locales";
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const defaultLocale = String(manifest.default_locale || "").trim();

if (!defaultLocale) fail("manifest.default_locale must name the fallback locale");
assertMessageReference(manifest.name, "manifest.name");
assertMessageReference(manifest.description, "manifest.description");
assertMessageReference(manifest.action?.default_title, "manifest.action.default_title");

const localeEntries = await readdir(localesRoot, { withFileTypes: true });
const locales = localeEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
if (!locales.includes(defaultLocale)) fail(`default locale ${defaultLocale} has no messages.json`);

const catalogs = new Map();
for (const locale of locales) {
  const messages = JSON.parse(await readFile(`${localesRoot}/${locale}/messages.json`, "utf8"));
  validateCatalog(locale, messages);
  catalogs.set(locale, messages);
}

const fallbackKeys = Object.keys(catalogs.get(defaultLocale)).sort();
for (const [locale, messages] of catalogs) {
  const keys = Object.keys(messages).sort();
  const missing = fallbackKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !fallbackKeys.includes(key));
  if (missing.length || extra.length) {
    fail(`${locale} keys differ from ${defaultLocale}; missing=[${missing.join(", ")}], extra=[${extra.join(", ")}]`);
  }
}

for (const reference of [manifest.name, manifest.description, manifest.action?.default_title]) {
  const key = reference.slice("__MSG_".length, -2);
  if (!catalogs.get(defaultLocale)[key]) fail(`manifest references missing default-locale key ${key}`);
}

console.log(`Localization metadata verification passed for ${locales.length} locales (${locales.join(", ")}).`);

function validateCatalog(locale, messages) {
  if (!messages || typeof messages !== "object" || Array.isArray(messages)) fail(`${locale} catalog must be an object`);
  for (const [key, entry] of Object.entries(messages)) {
    if (!/^[A-Za-z0-9_@]+$/.test(key)) fail(`${locale}.${key} is not a valid message key`);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) fail(`${locale}.${key} must be an object`);
    if (typeof entry.message !== "string" || !entry.message.trim()) fail(`${locale}.${key}.message must be nonempty`);
    if (entry.description !== undefined && typeof entry.description !== "string") fail(`${locale}.${key}.description must be a string`);
    if (entry.placeholders !== undefined && (!entry.placeholders || typeof entry.placeholders !== "object" || Array.isArray(entry.placeholders))) {
      fail(`${locale}.${key}.placeholders must be an object`);
    }
  }
}

function assertMessageReference(value, label) {
  if (typeof value !== "string" || !/^__MSG_[A-Za-z0-9_@]+__$/.test(value)) {
    fail(`${label} must use a __MSG_key__ localization reference`);
  }
}

function fail(message) {
  throw new Error(`Localization metadata verification failed: ${message}`);
}
