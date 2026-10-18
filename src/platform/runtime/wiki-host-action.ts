import type { MilxdyAppManifest, MilxdyContentAppModule } from "../app-sdk/app-platform";
import { contentScriptScopeForApp } from "./site-runtime";

type Result = { ok: boolean; reason?: "disabled" | "unavailable" | "invalid-url" | "cancelled" | "failed" };

export async function invokeWikiHostAction(args: {
  caller: MilxdyAppManifest;
  signal: AbortSignal;
  apps: readonly MilxdyAppManifest[];
  site: Parameters<typeof contentScriptScopeForApp>[1];
  isDisposed: () => boolean;
  isEnabled: (id: string) => boolean;
  isUnloading: (id: string) => boolean;
  load: (app: MilxdyAppManifest) => Promise<MilxdyContentAppModule | null>;
  url: string;
}): Promise<Result> {
  if (!args.caller.hostActions?.includes("wiki.openPage")) return { ok: false, reason: "unavailable" };
  const url = normalizeHostWikiUrl(args.url);
  if (!url) return { ok: false, reason: "invalid-url" };
  if (!active(args)) return { ok: false, reason: "cancelled" };
  const target = args.apps.find((app) => app.id === "wikiSidebar");
  if (!target || target.available === false || !contentScriptScopeForApp(target, args.site)) return { ok: false, reason: "unavailable" };
  if (!args.isEnabled(target.id)) return { ok: false, reason: "disabled" };
  try {
    const module = await args.load(target);
    if (!active(args)) return { ok: false, reason: "cancelled" };
    if (!args.isEnabled(target.id) || args.isUnloading(target.id)) return { ok: false, reason: "disabled" };
    const open = (module as (MilxdyContentAppModule & { openWikiUrl?: (value: string) => Promise<void> | void }) | null)?.openWikiUrl;
    if (!open) return { ok: false, reason: "failed" };
    await open(url);
    return !active(args) ? { ok: false, reason: "cancelled" } : !args.isEnabled(target.id) || args.isUnloading(target.id) ? { ok: false, reason: "disabled" } : { ok: true };
  } catch {
    return args.signal.aborted ? { ok: false, reason: "cancelled" } : { ok: false, reason: "failed" };
  }
}

function active(args: { signal: AbortSignal; caller: MilxdyAppManifest; isDisposed: () => boolean; isEnabled: (id: string) => boolean }): boolean {
  return !args.signal.aborted && !args.isDisposed() && args.isEnabled(args.caller.id);
}

function normalizeHostWikiUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, "https://wiki.remilia.org/");
    if (url.protocol !== "https:" || !["remilia.wiki", "wiki.remilia.org"].includes(url.hostname.toLowerCase())) return null;
    if (url.hostname.toLowerCase() === "remilia.wiki") url.hostname = "wiki.remilia.org";
    url.username = ""; url.password = ""; url.searchParams.delete("mobileaction"); url.searchParams.delete("useskin");
    return url.toString();
  } catch { return null; }
}
