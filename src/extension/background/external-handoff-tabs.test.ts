import { afterEach, describe, expect, it, vi } from "vitest";
import { createExternalHandoffTabs, EXTERNAL_HANDOFF_TABS_KEY } from "./external-handoff-tabs";
import { withExternalHandoffTimeout } from "../../platform/app-sdk/external-handoff";

const destination = "https://cult.inc/cheeseworld";
function fixture() {
  const values: Record<string, unknown> = {}, tabs = new Map<number, any>();
  const listeners = () => { const callbacks = new Set<(...args:any[])=>void>(); return {addListener:(f:any)=>callbacks.add(f),emit:(...args:any[])=>callbacks.forEach(f=>f(...args))}; };
  const onUpdated = listeners(), onActivated = listeners(), onRemoved = listeners();
  let sequence = 10;
  const storage = { get:vi.fn(async(key:string)=>({[key]:structuredClone(values[key])})),set:vi.fn(async(next:any)=>{Object.assign(values,structuredClone(next));}) };
  const api = {onUpdated,onActivated,onRemoved,
    create:vi.fn(async({url}:any)=>{const tab={id:sequence++,url,active:false};tabs.set(tab.id,tab);return {...tab};}),
    get:vi.fn(async(id:number)=>{if(!tabs.has(id))throw Error("closed");return {...tabs.get(id)};}),
    query:vi.fn(async()=>Array.from(tabs.values()).map(tab=>({...tab}))),
    remove:vi.fn(async(id:number)=>{tabs.delete(id);onRemoved.emit(id);}),
  };
  vi.stubGlobal("chrome",{tabs:api,storage:{local:storage}});
  return {values,tabs,api,storage,records:()=>values[EXTERNAL_HANDOFF_TABS_KEY] as any[]};
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

describe("durable temporary maker tab custody",()=>{
  it.each(["success","failure","cancel","timeout"])("closes only its owned background tab after %s",async(kind)=>{
    const f=fixture(), manager=createExternalHandoffTabs();
    const {tab,href}=await manager.create(destination);
    expect(new URL(href).pathname).toBe("/cheeseworld"); expect(new URL(href).search).toBe("");
    try {
      if(kind==="timeout") {vi.useFakeTimers();const pending=withExternalHandoffTimeout(new Promise(()=>{}),10);const assertion=expect(pending).rejects.toThrow();await vi.advanceTimersByTimeAsync(10);await assertion;}
      else if(kind!=="success") throw Error(kind);
    } catch {} finally {await manager.close(tab.id!);}
    expect(f.api.remove).toHaveBeenCalledExactlyOnceWith(tab.id);expect(f.records()).toEqual([]);
  });
  it("recovers after worker termination without rerunning recovery over new in-flight work",async()=>{
    const f=fixture(), first=createExternalHandoffTabs();const old=await first.create(destination);
    const restarted=createExternalHandoffTabs();await restarted.recover();
    expect(f.tabs.has(old.tab.id!)).toBe(false);
    const fresh=await restarted.create(destination);await restarted.recover();
    expect(f.tabs.has(fresh.tab.id!)).toBe(true);expect(f.records()).toHaveLength(1);
  });
  it("persists nonce intent before create and recovers a lost create response with pending URL",async()=>{
    const f=fixture();f.api.create.mockImplementationOnce(async({url}:any)=>{
      expect(f.records()).toEqual([{tabId:null,href:url}]);f.tabs.set(99,{id:99,url:"about:blank",pendingUrl:url,active:false});
      return new Promise(()=>{});
    });
    void createExternalHandoffTabs().create(destination);
    await vi.waitFor(()=>expect(f.api.create).toHaveBeenCalled());
    await createExternalHandoffTabs().recover();expect(f.api.remove).toHaveBeenCalledWith(99);expect(f.records()).toEqual([]);
  });
  it.each(["navigated","active","reused","pending-navigation"])("preserves a %s tab during recovery",async(kind)=>{
    const f=fixture();const {tab}=await createExternalHandoffTabs().create(destination);const live=f.tabs.get(tab.id!);
    if(kind==="active")live.active=true;
    else if(kind==="pending-navigation")live.pendingUrl="https://cult.inc/elsewhere";
    else live.url=kind==="reused"?destination:"https://example.com/user-work";
    await createExternalHandoffTabs().recover();expect(f.api.remove).not.toHaveBeenCalled();expect(f.records()).toEqual([]);
  });
  it("relinquishes custody when user activates or navigates away then returns",async()=>{
    const f=fixture(), manager=createExternalHandoffTabs();const a=await manager.create(destination),b=await manager.create(destination);
    f.api.onActivated.emit({tabId:a.tab.id});f.api.onUpdated.emit(b.tab.id,{url:"https://cult.inc/elsewhere"});
    await manager.close(a.tab.id!);await manager.close(b.tab.id!);expect(f.api.remove).not.toHaveBeenCalled();
  });
  it("keeps concurrent launches durable without overwriting one another",async()=>{
    const f=fixture(), manager=createExternalHandoffTabs();const pair=await Promise.all([manager.create(destination),manager.create("https://maker.remilia.org/remilio")]);
    expect(f.records()).toHaveLength(2);expect(new Set(f.records().map(record=>record.href)).size).toBe(2);
    await manager.close(pair[0].tab.id!);expect(f.records().map(record=>record.tabId)).toEqual([pair[1].tab.id]);
  });
  it("retains failed cleanup for next startup and never creates a tab if intent cannot persist",async()=>{
    const f=fixture(), manager=createExternalHandoffTabs();const owned=await manager.create(destination);
    f.api.remove.mockRejectedValueOnce(Error("interrupted"));await manager.close(owned.tab.id!);expect(f.records()).toHaveLength(1);
    await createExternalHandoffTabs().recover();expect(f.records()).toEqual([]);
    f.storage.set.mockRejectedValueOnce(Error("storage unavailable"));await expect(manager.create(destination)).rejects.toThrow("storage unavailable");expect(f.api.create).toHaveBeenCalledTimes(1);
  });
  it.each(["activation", "navigation"])("preserves user %s before create returns its tab ID",async(kind)=>{
    const f=fixture(), manager=createExternalHandoffTabs();
    f.api.create.mockImplementationOnce(async({url}:any)=>{
      f.tabs.set(7,{id:7,url,active:false});
      if(kind==="activation") f.api.onActivated.emit({tabId:7});
      else { f.api.onUpdated.emit(7,{url:"https://cult.inc/user-work"}); f.api.onUpdated.emit(7,{url}); }
      return {id:7,url,active:false};
    });
    const owned=await manager.create(destination);await manager.close(owned.tab.id!);
    expect(f.api.remove).not.toHaveBeenCalled();expect(f.records()).toEqual([]);
  });
  it.each(["activation", "navigation"])("preserves user %s during recovery before a lost tab ID is rebound",async(kind)=>{
    const f=fixture();const existing=await createExternalHandoffTabs().create(destination);
    f.values[EXTERNAL_HANDOFF_TABS_KEY]=[{tabId:null,href:existing.href}];
    f.api.query.mockImplementationOnce(async()=>{
      if(kind==="activation") f.api.onActivated.emit({tabId:existing.tab.id});
      else {f.api.onUpdated.emit(existing.tab.id,{url:"https://cult.inc/user-work"});f.api.onUpdated.emit(existing.tab.id,{url:existing.href});}
      return [{...f.tabs.get(existing.tab.id!)}];
    });
    await createExternalHandoffTabs().recover();expect(f.api.remove).not.toHaveBeenCalled();expect(f.records()).toEqual([]);
  });
  it("retries a transient startup failure before allowing new work",async()=>{
    const f=fixture();const old=await createExternalHandoffTabs().create(destination);
    const restarted=createExternalHandoffTabs();f.api.query.mockRejectedValueOnce(Error("temporarily unavailable"));
    await expect(restarted.recover()).rejects.toThrow("temporarily unavailable");
    const fresh=await restarted.create(destination);expect(f.tabs.has(old.tab.id!)).toBe(false);expect(f.tabs.has(fresh.tab.id!)).toBe(true);
  });
  it("rejects undeclared destinations before tab creation",async()=>{
    const f=fixture();await expect(createExternalHandoffTabs().create("https://cult.inc/unrelated")).rejects.toThrow("Unsupported");expect(f.api.create).not.toHaveBeenCalled();
  });
});
