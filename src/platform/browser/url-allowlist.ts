export type UrlAllowRule = {
  protocol?: "http:" | "https:";
  origin?: string;
  hostname?: string;
  includeSubdomains?: boolean;
  pathPrefix?: string;
  pathPattern?: RegExp;
  hrefPattern?: RegExp;
  allowedSearchParams?: readonly string[];
  allowHash?: boolean;
};

export function parseAllowedUrl(value: string, rules: readonly UrlAllowRule[]): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return rules.some((rule) => urlMatchesRule(url, rule)) ? url : null;
}

export function isAllowedUrl(value: string, rules: readonly UrlAllowRule[]): boolean {
  return parseAllowedUrl(value, rules) !== null;
}

function urlMatchesRule(url: URL, rule: UrlAllowRule): boolean {
  if (rule.protocol && url.protocol !== rule.protocol) return false;
  if (rule.origin && url.origin !== rule.origin) return false;
  if (rule.hostname && !hostnameMatches(url.hostname, rule.hostname, rule.includeSubdomains === true)) return false;
  if (rule.pathPrefix && !url.pathname.startsWith(rule.pathPrefix)) return false;
  if (rule.pathPattern && !rule.pathPattern.test(url.pathname)) return false;
  if (rule.hrefPattern && !rule.hrefPattern.test(url.href)) return false;
  if (rule.allowHash === false && url.hash) return false;
  if (rule.allowedSearchParams) {
    const allowed = new Set(rule.allowedSearchParams);
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key)) return false;
    }
  }
  return true;
}

function hostnameMatches(hostname: string, allowedHostname: string, includeSubdomains: boolean): boolean {
  const current = hostname.toLowerCase();
  const allowed = allowedHostname.toLowerCase();
  return current === allowed || (includeSubdomains && current.endsWith(`.${allowed}`));
}
