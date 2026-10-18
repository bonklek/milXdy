// Pure text scanning and rule classification; filesystem and trust decisions stay in the composer.
import {
  runtimeApiPattern,
  privilegedNamespacePattern,
  propertyAccessPattern,
  globalApiPattern,
  reflectGlobalApiPattern,
  constructedStringExpressionPattern,
  knownSensitiveStringExpressionPattern,
  staticSensitiveStringValue,
  charCodeStringExpressionPattern,
  atobStringExpressionPattern,
  jsTriviaPattern,
  escapeRegExp,
} from "./local-app-code-patterns.mjs";

const nonAcknowledgeablePackageApiRuleIds = new Set([
  "chrome-runtime-send-message",
  "chrome-runtime-connect",
  "browser-runtime-send-message",
  "browser-runtime-connect",
  "computed-extension-api-global",
  "computed-extension-api-global-from-decoder",
  "computed-extension-api-global-from-char-code",
  "computed-extension-api-global-from-reflect",
  "computed-runtime-api-property",
  "direct-fetch",
  "direct-xhr",
  "direct-websocket",
  "credential-material",
]);
const sensitivePackageApiRules = [
  {
    id: "chrome-runtime-send-message",
    severity: "error",
    pattern: runtimeApiPattern(globalApiPattern("chrome"), "sendMessage"),
    message: "uses chrome.runtime.sendMessage directly; local packages must use context.sendMessage() so background message authorization can enforce declared message types",
  },
  {
    id: "chrome-runtime-connect",
    severity: "error",
    pattern: runtimeApiPattern(globalApiPattern("chrome"), "connect"),
    message: "uses chrome.runtime.connect directly; port bridges require a reviewed background handler and sender policy",
  },
  {
    id: "browser-runtime-send-message",
    severity: "error",
    pattern: runtimeApiPattern(globalApiPattern("browser"), "sendMessage"),
    message: "uses browser.runtime.sendMessage directly; local packages must use context.sendMessage() so background message authorization can enforce declared message types",
  },
  {
    id: "browser-runtime-connect",
    severity: "error",
    pattern: runtimeApiPattern(globalApiPattern("browser"), "connect"),
    message: "uses browser.runtime.connect directly; port bridges require a reviewed background handler and sender policy",
  },
  {
    id: "extension-runtime-url",
    severity: "warning",
    pattern: runtimeApiPattern("(?:chrome|browser)", "getURL"),
    message: "constructs extension-origin URLs; review web-accessible resources, frame/worker loading, and package asset exposure",
  },
  {
    id: "broad-chrome-api",
    severity: "warning",
    pattern: privilegedNamespacePattern(globalApiPattern("chrome")),
    message: "references a privileged chrome.* API; package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "broad-browser-api",
    severity: "warning",
    pattern: privilegedNamespacePattern(globalApiPattern("browser")),
    message: "references a privileged browser.* API; package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "computed-extension-api-global",
    severity: "error",
    pattern: new RegExp(`\\b(?:[A-Za-z_$][\\w$]*|globalThis|window|self)\\s*\\[\\s*(?:${constructedStringExpressionPattern("chrome")}|${constructedStringExpressionPattern("browser")})\\s*\\]`, "g"),
    message: "constructs chrome/browser globals through computed string access; local package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "computed-extension-api-global-from-decoder",
    severity: "error",
    pattern: new RegExp(`\\b(?:[A-Za-z_$][\\w$]*|globalThis|window|self)${jsTriviaPattern()}\\[${jsTriviaPattern()}(?:${atobStringExpressionPattern("chrome")}|${atobStringExpressionPattern("browser")})${jsTriviaPattern()}\\]`, "g"),
    message: "constructs chrome/browser globals through decoded string access; local package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "computed-extension-api-global-from-char-code",
    severity: "error",
    pattern: new RegExp(`\\b(?:[A-Za-z_$][\\w$]*|globalThis|window|self)\\s*\\[\\s*(?:${charCodeStringExpressionPattern("chrome")}|${charCodeStringExpressionPattern("browser")})\\s*\\]`, "g"),
    message: "constructs chrome/browser globals through character-code string access; local package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "computed-extension-api-global-from-reflect",
    severity: "error",
    pattern: reflectGlobalApiPattern(),
    message: "constructs chrome/browser globals through Reflect.get(); local package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "computed-runtime-api-property",
    severity: "error",
    pattern: new RegExp(`\\[\\s*(?:${constructedStringExpressionPattern("runtime")}|${constructedStringExpressionPattern("sendMessage")}|${constructedStringExpressionPattern("connect")})\\s*\\]`, "g"),
    message: "constructs runtime/sendMessage/connect through computed string access; local package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "unsafe-eval",
    severity: "error",
    pattern: /\beval\s*\(/g,
    message: "uses eval(); local package payloads must not execute dynamically generated code",
  },
  {
    id: "unsafe-new-function",
    severity: "error",
    pattern: /\bnew\s+Function\s*\(/g,
    message: "uses new Function(); local package payloads must not execute dynamically generated code",
  },
  {
    id: "remote-script-loading",
    severity: "error",
    pattern: /(?:<script\b[^>]*\bsrc\s*=\s*["']https?:\/\/|importScripts\s*\(\s*["']https?:\/\/|import\s*\(\s*["']https?:\/\/|\.src\s*=\s*["']https?:\/\/[^"']+\.js\b)/gi,
    message: "loads remote script code; local packages must ship reviewed, declared package files instead",
  },
  {
    id: "dynamic-extension-internals",
    severity: "warning",
    pattern: /\b(?:chrome-extension|moz-extension):\/\//g,
    message: "references extension-origin internals directly; use declared package assets and reviewed platform APIs",
  },
  {
    id: "direct-fetch",
    severity: "error",
    pattern: /\bfetch\s*\(/g,
    message: "uses fetch directly; reviewed packages must use typed host capabilities and cannot issue authenticated or arbitrary network requests",
  },
  {
    id: "direct-xhr",
    severity: "error",
    pattern: /\b(?:new\s+)?XMLHttpRequest\b/g,
    message: "uses XMLHttpRequest directly; reviewed packages must use typed host capabilities",
  },
  {
    id: "direct-websocket",
    severity: "error",
    pattern: /\b(?:new\s+)?WebSocket\b/g,
    message: "uses WebSocket directly; Remilia realtime remains a trusted first-party legacy adapter",
  },
  {
    id: "credential-material",
    severity: "error",
    pattern: /(?:\bAuthorization\b\s*:|\bBearer\s+[A-Za-z0-9._~+/-]+|\b(?:accessToken|refreshToken|clientSecret)\b|\bdocument\s*\.\s*cookie\b|\bcredentials\s*:\s*["']include["'])/gi,
    message: "references credential material; package code cannot access OAuth tokens, cookies, authorization headers, or credentialed fetch",
  },
];


export function scanPayloadText(id, file, source) {
  const findings = [];
  for (const rule of sensitivePackageApiScanRules(source)) {
    rule.pattern.lastIndex = 0;
    for (const match of source.matchAll(rule.pattern)) {
      const location = locationForOffset(source, match.index ?? 0);
      findings.push({
        packageId: id,
        file,
        line: location.line,
        column: location.column,
        ruleId: rule.id,
        severity: rule.severity,
        match: trimmedMatch(match[0]),
        message: rule.message,
      });
    }
  }
  return findings;
}

function sensitivePackageApiScanRules(source) {
  const rules = [...sensitivePackageApiRules];
  const stringConstants = findStringConstants(source);
  const chromeAliases = expandSimpleAliasChains(source, [
    ...findSimpleGlobalAliases(source, "chrome"),
    ...findReflectGlobalAliases(source, "chrome"),
  ]);
  const browserAliases = expandSimpleAliasChains(source, [
    ...findSimpleGlobalAliases(source, "browser"),
    ...findReflectGlobalAliases(source, "browser"),
  ]);
  const runtimeAliases = expandSimpleAliasChains(source, [
    ...findRuntimeAliases(source, "chrome"),
    ...findRuntimeAliases(source, "browser"),
    ...findRuntimeAliasesForAliases(source, chromeAliases),
    ...findRuntimeAliasesForAliases(source, browserAliases),
  ]);
  for (const alias of chromeAliases) {
    rules.push(
      aliasRule("chrome-runtime-send-message", alias, "sendMessage"),
      aliasRule("chrome-runtime-connect", alias, "connect"),
      aliasRule("broad-chrome-api", alias),
    );
    rules.push(...variableHeldGlobalApiRules("chrome", alias, stringConstants));
  }
  for (const alias of browserAliases) {
    rules.push(
      aliasRule("browser-runtime-send-message", alias, "sendMessage"),
      aliasRule("browser-runtime-connect", alias, "connect"),
      aliasRule("broad-browser-api", alias),
    );
    rules.push(...variableHeldGlobalApiRules("browser", alias, stringConstants));
  }
  for (const alias of runtimeAliases) {
    rules.push(
      runtimeAliasRule("chrome-runtime-send-message", alias, "sendMessage"),
      runtimeAliasRule("chrome-runtime-connect", alias, "connect"),
    );
  }
  return rules;
}

function aliasRule(ruleId, alias, runtimeMethod) {
  const baseRule = sensitivePackageApiRules.find((rule) => rule.id === ruleId);
  return {
    ...baseRule,
    pattern: runtimeMethod
      ? runtimeApiPattern(escapeRegExp(alias), runtimeMethod)
      : privilegedNamespacePattern(escapeRegExp(alias)),
  };
}

function variableHeldGlobalApiRules(globalName, alias, stringConstants) {
  const rules = [];
  const runtimeKeys = variableNamesForValue(stringConstants, "runtime");
  const sendMessageKeys = variableNamesForValue(stringConstants, "sendMessage");
  const connectKeys = variableNamesForValue(stringConstants, "connect");
  const privilegedNamespaceKeys = variableNamesForValues(stringConstants, [
    "storage",
    "tabs",
    "cookies",
    "scripting",
    "permissions",
    "downloads",
    "webRequest",
    "runtime",
    "extension",
  ]);
  const runtimeRulePrefix = globalName === "browser" ? "browser" : "chrome";
  const broadRuleId = globalName === "browser" ? "broad-browser-api" : "broad-chrome-api";

  for (const runtimeKey of runtimeKeys) {
    for (const methodKey of sendMessageKeys) {
      rules.push(variableHeldRuntimeRule(`${runtimeRulePrefix}-runtime-send-message`, alias, runtimeKey, methodKey));
    }
    for (const methodKey of connectKeys) {
      rules.push(variableHeldRuntimeRule(`${runtimeRulePrefix}-runtime-connect`, alias, runtimeKey, methodKey));
    }
  }
  for (const namespaceKey of privilegedNamespaceKeys) {
    rules.push(variableHeldPrivilegedNamespaceRule(broadRuleId, alias, namespaceKey));
  }
  return rules;
}

function variableHeldRuntimeRule(ruleId, alias, runtimeKey, methodKey) {
  const baseRule = sensitivePackageApiRules.find((rule) => rule.id === ruleId);
  return {
    ...baseRule,
    pattern: new RegExp(`\\b${escapeRegExp(alias)}${jsTriviaPattern()}\\[${jsTriviaPattern()}${escapeRegExp(runtimeKey)}${jsTriviaPattern()}\\]${jsTriviaPattern()}\\[${jsTriviaPattern()}${escapeRegExp(methodKey)}${jsTriviaPattern()}\\]${jsTriviaPattern()}\\(`, "g"),
  };
}

function variableHeldPrivilegedNamespaceRule(ruleId, alias, namespaceKey) {
  const baseRule = sensitivePackageApiRules.find((rule) => rule.id === ruleId);
  return {
    ...baseRule,
    pattern: new RegExp(`\\b${escapeRegExp(alias)}${jsTriviaPattern()}\\[${jsTriviaPattern()}${escapeRegExp(namespaceKey)}${jsTriviaPattern()}\\]`, "g"),
  };
}

function runtimeAliasRule(ruleId, alias, runtimeMethod) {
  const baseRule = sensitivePackageApiRules.find((rule) => rule.id === ruleId);
  return {
    ...baseRule,
    pattern: new RegExp(`\\b${escapeRegExp(alias)}${jsTriviaPattern()}${propertyAccessPattern(runtimeMethod)}${jsTriviaPattern()}\\(`, "g"),
  };
}

function findSimpleGlobalAliases(source, globalName) {
  const aliases = new Set();
  const pattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${globalApiPattern(globalName)}(?![\\w$])`, "g");
  for (const match of source.matchAll(pattern)) {
    if (match[1] && match[1] !== globalName) aliases.add(match[1]);
  }
  return aliases;
}

function findReflectGlobalAliases(source, globalName) {
  const aliases = new Set();
  const pattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${reflectGlobalApiPattern(globalName).source}`, "g");
  for (const match of source.matchAll(pattern)) {
    if (match[1]) aliases.add(match[1]);
  }
  return aliases;
}

function findStringConstants(source) {
  const constants = new Map();
  const pattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'])([^"'\\]*(?:\\.[^"'\\]*)*)\2/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1];
    const value = decodeStaticStringLiteralBody(match[3] || "");
    if (name && value) constants.set(name, value);
  }
  const templatePattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*`([^`\\$]*(?:\\[\s\S][^`\\$]*)*)`/g;
  for (const match of source.matchAll(templatePattern)) {
    const name = match[1];
    const value = decodeStaticStringLiteralBody(match[2] || "");
    if (name && value) constants.set(name, value);
  }
  const constructedPattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(${knownSensitiveStringExpressionPattern()})`, "g");
  for (const match of source.matchAll(constructedPattern)) {
    const name = match[1];
    const value = staticSensitiveStringValue(match[2] || "");
    if (name && value) constants.set(name, value);
  }
  return constants;
}

function decodeStaticStringLiteralBody(value) {
  return value.replace(/\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([0-7]{1,3})|([\s\S]))/g, (_, codePointHex, unicodeHex, hex, octal, escaped) => {
    if (codePointHex) {
      const codePoint = Number.parseInt(codePointHex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    }
    if (unicodeHex || hex) return String.fromCharCode(Number.parseInt(unicodeHex || hex, 16));
    if (octal) return String.fromCharCode(Number.parseInt(octal, 8));
    return jsSingleCharacterEscapeValue(escaped);
  });
}

function jsSingleCharacterEscapeValue(value) {
  switch (value) {
    case "b":
      return "\b";
    case "f":
      return "\f";
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "v":
      return "\v";
    case "0":
      return "\0";
    case "\r":
    case "\n":
      return "";
    default:
      return value || "";
  }
}

function variableNamesForValue(constants, expectedValue) {
  return [...constants.entries()].filter(([, value]) => value === expectedValue).map(([name]) => name);
}

function variableNamesForValues(constants, expectedValues) {
  const allowed = new Set(expectedValues);
  return [...constants.entries()].filter(([, value]) => allowed.has(value)).map(([name]) => name);
}

function findRuntimeAliases(source, globalName) {
  const aliases = new Set();
  const globalPattern = globalApiPattern(globalName);
  const directPattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${globalPattern}\\s*${propertyAccessPattern("runtime")}`, "g");
  for (const match of source.matchAll(directPattern)) {
    if (match[1]) aliases.add(match[1]);
  }
  const destructurePattern = new RegExp(`\\b(?:const|let|var)\\s*\\{([^}]+)\\}\\s*=\\s*${globalPattern}\\b`, "g");
  for (const match of source.matchAll(destructurePattern)) {
    for (const alias of destructuredRuntimeAliases(match[1] || "")) aliases.add(alias);
  }
  return aliases;
}

function findRuntimeAliasesForAliases(source, globalAliases) {
  const aliases = new Set();
  for (const globalAlias of globalAliases) {
    const directPattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegExp(globalAlias)}\\s*${propertyAccessPattern("runtime")}`, "g");
    for (const match of source.matchAll(directPattern)) {
      if (match[1]) aliases.add(match[1]);
    }
    const destructurePattern = new RegExp(`\\b(?:const|let|var)\\s*\\{([^}]+)\\}\\s*=\\s*${escapeRegExp(globalAlias)}\\b`, "g");
    for (const match of source.matchAll(destructurePattern)) {
      for (const alias of destructuredRuntimeAliases(match[1] || "")) aliases.add(alias);
    }
  }
  return aliases;
}

function expandSimpleAliasChains(source, initialAliases) {
  const aliases = new Set(initialAliases);
  let changed = true;
  while (changed) {
    changed = false;
    for (const alias of [...aliases]) {
      const pattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegExp(alias)}\\b`, "g");
      for (const match of source.matchAll(pattern)) {
        if (match[1] && !aliases.has(match[1])) {
          aliases.add(match[1]);
          changed = true;
        }
      }
    }
  }
  return aliases;
}

function destructuredRuntimeAliases(bindingSource) {
  const aliases = [];
  const runtimeBinding = /(?:^|,)\s*runtime\s*(?::\s*([A-Za-z_$][\w$]*))?(?:\s*=[^,]+)?(?=,|$)/g;
  for (const match of bindingSource.matchAll(runtimeBinding)) {
    aliases.push(match[1] || "runtime");
  }
  return aliases;
}

export function isNonAcknowledgeableSensitiveFinding(finding) {
  return nonAcknowledgeablePackageApiRuleIds.has(finding.ruleId);
}

function locationForOffset(source, offset) {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function trimmedMatch(value) {
  return value.replace(/\s+/g, " ").slice(0, 120);
}
