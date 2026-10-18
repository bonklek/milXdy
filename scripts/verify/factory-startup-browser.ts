import { createContentRuntime } from '../../src/platform/runtime/content-runtime';
import { FIRST_PARTY_APPS } from '../../src/platform/app-sdk/first-party-registry';

const stored: Record<string, unknown> = {};
const noopEvent = { addListener() {}, removeListener() {} };
const storage = { async get(keys: string | string[] | Record<string, unknown>) {
  const defaults = typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
  return { ...defaults, ...Object.fromEntries(Object.entries(stored).filter(([key]) => typeof keys === 'string' ? key === keys : Array.isArray(keys) ? keys.includes(key) : key in keys)) };
}, async set(values: Record<string, unknown>) { Object.assign(stored, values); } };
(globalThis as any).chrome = { runtime: { id:'factory-fixture', getURL:(path:string)=>`https://extension.invalid/${path}`, onMessage:noopEvent, async sendMessage(){return {ok:false};} }, storage:{local:storage,sync:storage,onChanged:noopEvent} };
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
const wait = async (predicate: () => boolean) => { const start=Date.now(); while(!predicate()){if(Date.now()-start>4000)throw new Error('Factory startup timed out');await new Promise(resolve=>setTimeout(resolve,25));} };
async function verify() {
  const factory = FIRST_PARTY_APPS.find(app=>app.id==='tweet-composer-kit');
  check(factory?.available && factory.defaultEnabled, 'Default browser registry omits reviewed Factory');
  if (!factory) return;
  check(await factory.isEnabled(), 'Fresh browser storage does not enable Factory');
  const key = factory.settings!.find(setting=>setting.role==='enablement')!.storage!.key;
  stored[key]=false;
  check(!await factory.isEnabled(), 'Explicit user disable was overridden'); delete stored[key];
  document.body.innerHTML='<main><div data-testid="tweetTextarea_0" contenteditable="true"></div><div data-testid="toolBar"><div data-testid="ScrollSnap-List"></div></div></main>';
  const runtime = createContentRuntime([factory], {id:'x',mode:'fullRail',origin:'https://x.com',pathname:'/home'} as any);
  await runtime.boot();
  const buttons = () => [...document.querySelectorAll<HTMLButtonElement>('button[data-app-id="tweet-composer-kit"]')];
  await wait(()=>buttons().length===2);
  check(buttons().some(button=>button.title==='Factory'), 'Factory absent before first user action');
  check(buttons().some(button=>button.dataset.hostAction==='nativeDrafts'), 'Drafts companion absent');
  document.querySelector('main')!.innerHTML='<div data-testid="tweetTextarea_0" contenteditable="true"></div><div data-testid="toolBar"><div data-testid="ScrollSnap-List"></div></div>';
  await wait(()=>buttons().length===2);
  await runtime.dispose();
  (globalThis as any).__factoryResult={passed:true,freshStartup:true,explicitDisablePreserved:true,replacedToolbar:true};
}
void verify().catch(error=>{ (globalThis as any).__factoryResult={passed:false,error:String(error),stack:error.stack}; });
