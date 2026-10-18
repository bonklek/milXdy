import { FIRST_PARTY_APPS } from '../../src/platform/app-sdk/first-party-registry';
import { createContentRuntime } from '../../src/platform/runtime/content-runtime';
import type { MilxdyAppManifest } from '../../src/platform/app-sdk/app-platform';
const values: Record<string, unknown> = {};
const event = { addListener() {}, removeListener() {} };
const storage = { async get(keys: string | string[] | Record<string,unknown>) {
  const defaults = typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
  return { ...defaults, ...Object.fromEntries(Object.entries(values).filter(([key]) => typeof keys === 'string' ? key === keys : Array.isArray(keys) ? keys.includes(key) : key in keys)) };
}, async set(next: Record<string,unknown>) { Object.assign(values,next); }, async remove() {} };
let messages = 0;
(globalThis as any).chrome = { runtime: { id:'hub-craft-fixture',getURL:(p:string)=>'https://extension.invalid/'+p,onMessage:event,async sendMessage(){messages++;return {ok:false};} },storage:{local:storage,sync:storage,onChanged:event} };
const template = FIRST_PARTY_APPS.find(app=>app.hub)!;
const apps = ['alpha','beta'].map(id => ({ ...template, dock:undefined, id, name: id === 'alpha'?'Alpha feature':'Beta feature',description:'Synthetic feature for keyboard verification.',packageKind:'feature',loadTriggers:[],defaultEnabled:false,available:true,isEnabled:async()=>false,setEnabled:async()=>{},siteScopes:[{site:'x',hosts:['https://x.com/*']}],load:async()=>({}),hub:{...template.hub,category:'utility',shortDescription:'Review keyboard focus and settings.',rail:{supported:false}},settings:[{id:'same-setting',label:'Example text',scope:'feature',location:'appsAndFeatures',storage:{area:'local',key:'fixture.'+id},control:{type:'text'},defaultValue:'abcdef',reset:{behavior:'default'}}] })) as unknown as MilxdyAppManifest[];
async function setup() {
  const runtime=createContentRuntime(apps,{id:'x',mode:'fullRail',origin:'https://x.com',pathname:'/home'} as any);
  await runtime.boot();
  let inspected=0,assigned=0,submitted=0,hostDown=0;
  const craft=document.createElement('section');craft.className='crafting-module';craft.style.cssText='margin:20px;padding:20px;background:#fff;color:#222';
  craft.innerHTML='<h2>Native crafting fixture</h2><button class="crafting-module__beetle-item">Metal item</button><button class="crafting-module__beetle-item crafting-module__beetle-item--unavailable">Unavailable green</button><div class="crafting-module__input-slot"></div><button id="native-submit">Native Craft</button>';
  const item=craft.querySelector<HTMLButtonElement>('.crafting-module__beetle-item')!;
  const store={mode:'assemble',craftingSlots:{input1:null},assignToSlot(){assigned++;},removeFromSlot(){},selectHammer(){},clearHammer(){},selectSacrifice(){assigned++;},selectedHammer:null,selectedSacrificeBeetle:null};
  (item as any).__reactFiber$fixture={memoizedProps:{type:'metal',count:2,store,onMouseDown(){hostDown++;},onMouseUp(){inspected++;}}};
  (craft.querySelector('.crafting-module__beetle-item--unavailable') as any).__reactFiber$fixture={memoizedProps:{type:'green',count:0,store}};
  item.addEventListener('mousedown',()=>hostDown++);craft.querySelector('#native-submit')!.addEventListener('click',()=>submitted++);document.body.append(craft);
  const native=window.setTimeout,delaysA:number[]=[],delaysB:number[]=[];
  const before = ((handler: TimerHandler,delay?:number,...args:any[])=>{delaysA.push(delay||0);return native(handler,delay,...args);}) as typeof window.setTimeout;
  window.setTimeout=before;
  const { installReminetCraftFastPath }=await import('../../src/extension/frames/reminet-craft-fast-path-runtime');
  const dispose=installReminetCraftFastPath();
  const after = ((handler: TimerHandler,delay?:number,...args:any[])=>{delaysB.push(delay||0);return before(handler,delay,...args);}) as typeof window.setTimeout;window.setTimeout=after;
  (globalThis as any).hubCraftFixture={ready:true,runtime,item,dispose,values,counts:()=>({inspected,assigned,submitted,hostDown,messages}),timers:()=>({same:window.setTimeout===after,delaysA,delaysB}),route:(enabled:boolean,cartridge='craft')=>{history.replaceState(null,'','?cartridge='+cartridge);document.documentElement.setAttribute('data-milxdy-reminet-beetle-reduced-motion-setting',String(enabled));},outside:()=>{const button=document.createElement('button');button.id='outside';button.textContent='Outside panel';document.body.append(button);return button;},unrelated:()=>[1000,2000,3000].forEach(delay=>setTimeout(()=>{},delay))};
}
void setup().catch(error=>{(globalThis as any).hubCraftFixture={error:String(error)};});
