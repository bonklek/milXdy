import { createConversationHighlight } from '../../src/apps/post-reading/direct-message-highlighting';
import * as reader from '../../src/apps/post-reading/content';
import { FIRST_PARTY_APPS } from '../../src/platform/app-sdk/first-party-registry';
import { createContentRuntime } from '../../src/platform/runtime/content-runtime';

const checks: string[] = [];
function check(value: unknown, label: string) { if (!value) throw new Error(label); checks.push(label); }
const wait = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms));
async function until(test: () => unknown, label: string) { const deadline = Date.now() + 5000; while (!test()) { if (Date.now() > deadline) throw new Error(label); await wait(); } }
const query = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const action = () => query<HTMLButtonElement>('[data-post-reading-dm-button]');
const review = () => query<HTMLDialogElement>('[data-post-reading-dm-review]');
const entry = (id: string, text: string) => `<div data-testid="messageEntry" data-message-id="${id}" data-message-direction="incoming"><time>12:00</time><div data-testid="messageText">${text}</div><button>React</button></div>`;
let requests = 0;
let configuredCustomHttp = false;
let primingRequests = 0;
const activeUtterance = { value: null as SpeechSynthesisUtterance | null };
const spoken: string[] = [];
const event = { addListener() {}, removeListener() {} };
const storage = { async get(keys: any) { const values = typeof keys === 'object' && !Array.isArray(keys) ? { ...keys } : {}; for (const key of Object.keys(values)) { if (/ttsEngine$/i.test(key)) { values[key] = 'custom-http'; configuredCustomHttp = true; } if (/customTtsEndpoint$/i.test(key)) values[key] = 'https://fixture.invalid/private-tts'; } return values; }, async set() {}, async remove() {} };
const declared = FIRST_PARTY_APPS.find(app => app.id === 'post-reading')!;
const asset = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"/>');
(globalThis as any).__dmReader = reader;
const moduleUrl = URL.createObjectURL(new Blob(['export const boot = (...args) => globalThis.__dmReader.boot(...args); export const dispose = () => globalThis.__dmReader.dispose(); export const onRouteChange = (...args) => globalThis.__dmReader.onRouteChange(...args);'], {type:'text/javascript'}));
(globalThis as any).chrome = { runtime:{id:'dm-reader-fixture', getURL:(path:string) => path === declared.contentEntry ? moduleUrl : asset, onMessage:event, sendMessage:async(message:unknown)=>{if (/Synthetic|Loaded after review/.test(JSON.stringify(message))) requests++; return null;}}, storage:{local:storage,sync:storage,onChanged:event} };
window.fetch = async () => { requests++; throw new Error('Controlled fixture blocks HTTP'); };
class FixtureUtterance { onstart: ((event: Event) => void) | null = null; onend = null; onerror = null; onboundary = null; voice = null; rate = 1; volume = 1; constructor(readonly text: string) {} }
Object.defineProperty(window, 'SpeechSynthesisUtterance', {configurable:true,value:FixtureUtterance});
const voice = { voiceURI:'fixture-local',name:'Fixture local voice',lang:'en-US',localService:true,default:true };
const nativeFlagSynthesis = { speaking:false, pending:false, paused:false, getVoices:()=>[voice], cancel(){nativeFlagSynthesis.speaking=false;}, pause(){nativeFlagSynthesis.paused=true;}, resume(){nativeFlagSynthesis.paused=false;}, speak(utterance: SpeechSynthesisUtterance) {
  nativeFlagSynthesis.speaking=true;
  if(utterance.text === 'one two three four') { primingRequests++; setTimeout(()=>{nativeFlagSynthesis.speaking=false;utterance.onend?.(new Event('end') as any);},20); return; }
  activeUtterance.value = utterance; spoken.push(utterance.text); utterance.onstart?.(new Event('start') as any);
}, onvoiceschanged:null };
Object.defineProperty(window, 'speechSynthesis', {configurable:true,value:nativeFlagSynthesis});

async function run() {
  const style = document.createElement('style'); style.textContent = 'body{margin:0;padding:24px;font:16px system-ui;background:#f5f6f8} main{margin:80px 220px 0 180px;padding:20px;background:white} [data-testid="DmActivityViewport"],[data-testid="dm-conversation-panel"]{height:300px;overflow:auto;border:1px solid #aaa} [data-testid="messageEntry"]{padding:18px}'; document.head.append(style);
  const main = document.createElement('main'); main.innerHTML = '<h1>Controlled DM reader fixture</h1><p>Synthetic messages only. No live private content.</p><aside data-testid="inbox">Inbox preview must not be read</aside><div data-testid="DmActivityViewport">'+entry('1','Synthetic visible message')+'<div hidden>'+entry('2','Hidden message')+'</div><textarea>Unsent draft</textarea><div style="height:1500px"></div></div>'; document.body.append(main);
  const app = {...declared,available:true,isEnabled:async()=>true,dock:undefined,hub:undefined};
  const runtime = createContentRuntime([app], {id:'x',mode:'fullRail',origin:'https://x.com',pathname:location.pathname} as any);
  try {
    await runtime.boot();
    await until(action, 'Production runtime did not load reader for /i/chat conversation route');
    check(Boolean(action()), 'Production registry route discovery boots the actual reader and mounts the DM action');
    const viewport = query<HTMLElement>('[data-testid="DmActivityViewport"]')!; viewport.scrollTop = viewport.scrollHeight;
    const rect = action()!.getBoundingClientRect();
    check(rect.top >= 0 && rect.bottom <= innerHeight && !viewport.contains(action()), 'Action stays visible outside a scrolled virtualized message viewport');
    check(spoken.length === 0 && requests === 0 && !review(), 'Discovery neither extracts a review nor starts speech or HTTP requests');
    action()!.click();
    check(review()?.open && query<HTMLTextAreaElement>('[aria-label="Visible messages to read"]')?.value === 'Other person: Synthetic visible message', 'Explicit click opens review of recognized message bodies only');
    check(document.activeElement?.textContent === 'Cancel' && spoken.length === 0 && requests === 0, 'Review defaults to Cancel and waits for explicit browser-voice confirmation');
    check(review()!.textContent?.includes('Custom HTTP TTS is bypassed') && review()!.textContent?.includes('remote voice service'), 'Private review explains browser voice privacy boundary');
    const appended = document.createElement('div'); appended.innerHTML = entry('3','Loaded after review'); viewport.append(appended);
    Array.from(review()!.querySelectorAll('button')).find(button=>button.textContent==='Read with browser voice')!.click();
    await until(()=>spoken.length, 'Browser voice was not invoked');
    check(spoken.join(' ').includes('Synthetic visible message') && !spoken.join(' ').includes('Loaded after review'), 'Browser voice uses the reviewed immutable snapshot');
    check(configuredCustomHttp && requests === 0, 'Configured custom HTTP TTS receives no private-message request');
    check(primingRequests > 0, 'Native speaking/pending flags exercise actual priming path before reviewed speech');
    history.pushState({}, '', '/messages/123-456'); await wait(800);
    action()!.click();
    check(query<HTMLTextAreaElement>('[aria-label="Visible messages to read"]')?.value.includes('Loaded after review'), 'Legacy conversation route captures newly loaded messages only in a new review');
    query<HTMLButtonElement>('dialog button[autofocus]')!.click();
    history.pushState({}, '', '/i/chat'); viewport.remove(); const unsupported = document.createElement('section'); unsupported.dataset.testid = 'chat-drawer-main'; unsupported.innerHTML = '<p>Unrecognized private layout content</p><textarea>Unsent composer draft</textarea>'; main.append(unsupported); await wait(800);
    action()!.click();
    check(review()?.open && !query('[aria-label="Visible messages to read"]') && !review()!.textContent?.includes('Read with browser voice'), 'Modern chat landing without recognized messages gives bounded guidance and no read action');
    check(review()!.textContent?.includes('Some X Chat layouts are not supported yet'), 'Unsupported modern markup is explained instead of silently hiding the action');
    query<HTMLButtonElement>('dialog button[autofocus]')!.click();
    // Exact structural selectors observed read-only on current X; all text and IDs below are synthetic.
    const host = document.createElement('div'); host.dataset.testid = 'xchatEmbedRoute'; main.append(host);
    const shadow = host.attachShadow({mode:'open'});
    shadow.innerHTML = '<style>[data-testid="dm-conversation-panel"]{display:block;min-height:200px} [data-testid="dm-message-scroller"]{height:140px;overflow:auto}</style><aside data-testid="dm-inbox-panel">Private inbox preview excluded</aside><section data-testid="dm-conversation-panel"><div role="log" data-testid="dm-message-scroller"><div data-testid="message-synthetic-4"><div role="article"><div data-testid="message-text-synthetic-4"><span>Synthetic</span>  panel<br>\n<strong>message</strong> <a href="https://example.invalid/fixture">link</a> 😀<span hidden>Hidden descendant</span></div></div><button>React</button></div><div data-testid="message-synthetic-4"><div role="article"><div data-testid="message-text-synthetic-4"><span>Synthetic</span>  panel<br>\n<strong>message</strong> <a href="https://example.invalid/fixture">link</a> 😀<span hidden>Hidden descendant</span></div></div></div><div hidden data-testid="message-synthetic-hidden"><div data-testid="message-text-synthetic-hidden">Hidden private body</div></div></div><textarea data-testid="dm-composer-textarea">Unsent private draft</textarea></section>';
    const panel = shadow.querySelector<HTMLElement>('[data-testid="dm-conversation-panel"]')!;
    const modernBody = shadow.querySelector<HTMLElement>('[data-testid="message-text-synthetic-4"]')!;
    const originalHtml = modernBody.innerHTML, originalText = modernBody.textContent;
    const originalSpan = modernBody.querySelector('span')!; let retainedListener = 0; originalSpan.addEventListener('click',()=>retainedListener++);
    action()!.click();
    check(query<HTMLTextAreaElement>('[aria-label="Visible messages to read"]')?.value === 'Message: Synthetic panel message link 😀', 'Observed modern X shadow conversation reads exact body wrappers, deduplicates copies, excludes inbox/composer/hidden text');
    Array.from(review()!.querySelectorAll('button')).find(button=>button.textContent==='Read with browser voice')!.click();
    await until(()=>spoken.length === 2, 'Modern shadow conversation did not reach browser speech');
    check(spoken[1] === 'Message: Synthetic panel message link 😀' && requests === 0, 'Observed modern shadow fixture reaches browser-only playback after explicit review');
    activeUtterance.value!.onboundary?.({charIndex:9,charLength:9,elapsedTime:0.5} as SpeechSynthesisEvent);
    check(modernBody.innerHTML === originalHtml && modernBody.textContent === originalText && modernBody.querySelector('span') === originalSpan, 'During DM reading exact text, double spaces, inline markup and original node identities remain unchanged');
    originalSpan.click(); check(retainedListener === 1, 'Native message child listeners survive active highlighting');
    const painted = CSS.highlights.get('milxdy-private-message-word');
    check(Boolean(painted) && Array.from(painted!).some(range=>range.toString()==='Synthetic'), 'DM boundary paints an original shadow text range without token spans');
    check(!modernBody.querySelector('[data-post-reading-word], [data-post-reading-smooth-word]'), 'Private messages never enter destructive word/smooth tokenization');
    const paintedBounds = modernBody.getBoundingClientRect();
    Object.assign(globalThis, {__dmHighlightReady:true,__dmHighlightProofRect:{x:paintedBounds.x,y:paintedBounds.y,width:paintedBounds.width,height:paintedBounds.height,scale:1}});
    await until(()=>(globalThis as any).__dmHighlightCaptured, 'Runner did not capture synthetic shadow highlight');
    activeUtterance.value!.onboundary?.({charIndex:25,charLength:7,elapsedTime:1} as SpeechSynthesisEvent);
    check(modernBody.innerHTML === originalHtml && modernBody.textContent === originalText && Array.from(CSS.highlights.get('milxdy-private-message-word') || []).some(range=>range.toString()==='message'), 'Moving DM word boundaries across collapsed spaces paints the original inline text without changing it');
    activeUtterance.value!.onboundary?.({charIndex:33,charLength:4,elapsedTime:1.5} as SpeechSynthesisEvent);
    check(Array.from(CSS.highlights.get('milxdy-private-message-word') || []).some(range=>range.toString()==='link') && modernBody.innerHTML===originalHtml, 'Multiline message offsets map into the original inline link without rewriting it');
    activeUtterance.value!.onboundary?.({charIndex:38,charLength:2,elapsedTime:2} as SpeechSynthesisEvent);
    check(Array.from(CSS.highlights.get('milxdy-private-message-word') || []).some(range=>range.toString()==='😀') && modernBody.textContent===originalText, 'Emoji boundaries retain both original UTF-16 code units');
    const stop = Array.from(document.querySelectorAll<HTMLButtonElement>('.post-reading-player button')).find(button=>button.getAttribute('aria-label')==='Quit reading');
    check(Boolean(stop), 'Production player exposes Stop for the DM session'); stop!.click();
    check(modernBody.innerHTML === originalHtml && modernBody.querySelector('span')===originalSpan && !CSS.highlights.has('milxdy-private-message-word'), 'Stopping clears range paint without replacing host message DOM');
    action()!.click(); Array.from(review()!.querySelectorAll('button')).find(button=>button.textContent==='Read with browser voice')!.click();
    await until(()=>spoken.length === 3, 'Second modern review did not start');
    action()!.click(); panel.replaceChildren();
    Array.from(review()!.querySelectorAll('button')).find(button=>button.textContent==='Read with browser voice')!.click();
    check(spoken.length === 3, 'Recycled conversation bodies invalidate stale review before playback');
    history.pushState({}, '', '/home'); await wait(800);
    check(!action() && !review() && !CSS.highlights.has('milxdy-private-message-word') && !shadow.querySelector('[data-post-reading-conversation-highlight]') && modernBody.innerHTML === originalHtml, 'Leaving conversation routes removes private reader UI and range styles without restoring/replacing message markup');
    history.pushState({}, '', '/i/chat/g123'); await wait(800);
    check(Boolean(action()), 'Group chat route exposes action even when extraction is unavailable');
    await runtime.dispose();
    check(!action() && !review(), 'Production lifecycle disposal removes DM action and review');
    const bounded = document.createElement('div'); shadow.append(bounded); bounded.textContent = 'Synthetic oversized message. '.repeat(4000);
    const boundedHtml = bounded.innerHTML; const painter = createConversationHighlight();
    check(!painter.paint(bounded, bounded.textContent, 0) && bounded.innerHTML === boundedHtml && !CSS.highlights.has('milxdy-private-message-word'), 'Oversized messages skip range allocation without changing playback source DOM');
    bounded.innerHTML = '<span>Reviewed source</span>'; painter.paint(bounded, 'Reviewed source', 0);
    bounded.innerHTML = '<a href="https://example.invalid/updated">Updated by host</a>'; const updated = bounded.innerHTML;
    check(!painter.paint(bounded, 'Reviewed source', 0) && bounded.innerHTML === updated && !CSS.highlights.has('milxdy-private-message-word'), 'Host-recycled text invalidates range paint without restoring stale reviewed markup'); painter.clear();
    return {passed:true,checks,liveModernStructureVerified:true,livePrivatePlaybackTested:false};
  } finally { await runtime.dispose(); URL.revokeObjectURL(moduleUrl); }
}
run().then(result => (globalThis as any).__dmReaderResult = result).catch(error => (globalThis as any).__dmReaderResult = {passed:false,checks,error:String(error)});
