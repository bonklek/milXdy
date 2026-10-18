import { FIRST_PARTY_APPS } from "../../src/platform/app-sdk/first-party-registry";
import { createContentRuntime } from "../../src/platform/runtime/content-runtime";
import type { MilxdyContextualPostActionContext, MilxdyAppManifest } from "../../src/platform/app-sdk/app-platform";

/** Real host menu injection, with only extension storage/module loading replaced locally. */
export async function readerShareMenuFixture(onAction: (context: MilxdyContextualPostActionContext) => void): Promise<ReturnType<typeof createContentRuntime>> {
  const event = { addListener() {}, removeListener() {} };
  const storage = { async get(keys: unknown) { return typeof keys === "object" && !Array.isArray(keys) ? keys : {}; }, async set() {}, async remove() {} };
  const moduleUrl = URL.createObjectURL(new Blob(['export function onContextualPostAction(context) { globalThis.__readerShareAction(context); }'], {type:"text/javascript"}));
  (globalThis as any).__readerShareAction = onAction;
  const declared = FIRST_PARTY_APPS.find(app => app.id === "post-reading")!;
  (globalThis as any).chrome = { runtime:{id:"reader-share-fixture",getURL:(path:string) => path === declared.contentEntry ? moduleUrl : "https://extension.invalid/"+path,onMessage:event,sendMessage:async()=>null},storage:{local:storage,sync:storage,onChanged:event} };
  const app: MilxdyAppManifest = {...declared, available:true, isEnabled:async()=>true, dock:undefined, hub:undefined, loadTriggers:["userAction"]};
  const runtime = createContentRuntime([app], {id:"x",mode:"fullRail",origin:"https://x.com",pathname:"/home"} as any);
  await runtime.boot();
  const originalDispose = runtime.dispose;
  runtime.dispose = async () => { await originalDispose(); URL.revokeObjectURL(moduleUrl); delete (globalThis as any).__readerShareAction; };
  return runtime;
}

export async function openReaderShareMenu(post: HTMLElement): Promise<HTMLElement> {
  const share = document.createElement("button"); share.dataset.testid = "share"; share.ariaLabel = "Share post"; share.textContent = "Share"; post.append(share);
  const menu = document.createElement("div"); menu.setAttribute("role", "menu"); menu.innerHTML = '<div role="menuitem" tabindex="0"><div></div><div><span>Native Share action</span></div></div>';
  share.onclick = () => document.body.append(menu); share.click();
  const started = Date.now();
  while (!menu.querySelector('[data-milxdy-contextual-post-action="post-reading:reviewMp3"]')) {
    if (Date.now() - started > 3000) throw new Error("Host did not inject declared MP3 Share action");
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return menu.querySelector<HTMLElement>('[data-milxdy-contextual-post-action="post-reading:reviewMp3"]')!;
}
