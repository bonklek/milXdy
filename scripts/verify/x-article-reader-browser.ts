import { boot, dispose, onRouteChange, onSurface } from "../../src/apps/post-reading/content";
import { extractXArticleTextContainers } from "../../src/platform/scanner/x-article";
import { DEFAULT_SETTINGS } from "../../src/apps/post-reading/shared/defaults";

const checks: string[] = [];
function check(value: unknown, label: string): void { if (!value) throw new Error(label); checks.push(label); }
const wait = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
async function until(test: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 150 && !test(); i++) await wait(20);
  check(test(), label);
}
async function run(): Promise<void> {
  const style = document.createElement("style");
  style.textContent = 'body{font:16px Arial;margin:20px;max-width:640px}.author,.actions{display:flex;align-items:center;gap:18px}.author-name{flex:1}.css-hidden{display:none}.css-invisible{visibility:hidden}.hero{height:130px;background:#ddd;margin:20px 0}.actions{justify-content:space-between}h1{font-size:38px}p{line-height:1.5}';
  document.head.append(style);
  const utterances: SpeechSynthesisUtterance[] = [];
  let pauses = 0, resumes = 0, cancels = 0;
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    getVoices: () => [], cancel: () => { cancels++; },
    pause: () => { pauses++; }, resume: () => { resumes++; },
    speak: (utterance: SpeechSynthesisUtterance) => { utterances.push(utterance); setTimeout(() => utterance.dispatchEvent(new Event("start")), 0); },
  } });
  let stored = { ...DEFAULT_SETTINGS, bodyHighlightMode: "word", includeImageOcr: false, includeImageAltText: false, includeLinkPreviews: false, expandShowMore: false, autoplayNext: false };
  const listeners = new Set<(changes: Record<string, unknown>) => void>();
  const area = { get: async (fallback: object) => ({ ...fallback, ...stored }), set: async (next: object) => {
    const changes = Object.fromEntries(Object.entries(next).map(([key, value]) => [key, { oldValue: (stored as any)[key], newValue: value }]));
    stored = { ...stored, ...next }; for (const callback of listeners) callback(changes);
  }, onChanged: (callback: (changes: Record<string, unknown>) => void) => { listeners.add(callback); return () => listeners.delete(callback); } };
  const abort = new AbortController();
  await boot({ signal: abort.signal, storage: { sync: area, local: { ...area, get: async (fallback: object) => fallback, set: async () => undefined } }, resolveAssetUrl: () => "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" } as unknown as Parameters<typeof boot>[0]);
  const article = document.createElement("div"); article.dataset.testid = "twitterArticleReadView";
  article.innerHTML = `<header class="author"><div class="author-name" data-testid="User-Name"><a href="/fixture"><span>Fixture author</span></a></div><div class="native-controls"><button aria-label="Grok actions">G</button><button data-testid="caret" aria-label="More">…</button></div></header><article data-testid="tweet" id="embed"><span data-milxdy-tweet-slot="post-reading-header-action"><button data-post-reading-button="true">Embedded reader</button></span><button data-testid="caret">Embedded overflow</button></article><div class="hero" aria-label="Synthetic hero image"></div><h1 data-testid="twitter-article-title">Synthetic article title</h1><div class="actions" role="group"><button data-testid="reply">Reply</button><button data-testid="like">Like</button><button>Share</button></div><div data-testid="twitterArticleRichTextView"><div data-testid="longformRichTextComponent"><div><p id="first">First <span class="css-hidden">private hidden duplicate</span><span style="display:none">inline hidden</span><span class="css-invisible">invisible text</span><strong>bold</strong> paragraph with <a href="https://example.invalid/">https://example.invalid/</a> trailing words.</p><p id="second">Second     paragraph with <em>inline formatting</em> and a final sentence.</p><p id="third">Repeated sentence.</p><p id="fourth">Repeated sentence.</p></div></div></div>`;
  document.body.append(article);
  const deliver = () => onSurface({ kind: "xArticle", element: article, actionRow: article.querySelector('.actions'), textContainers: extractXArticleTextContainers(article) } as unknown as Parameters<typeof onSurface>[0]);
  deliver();
  await until(() => Boolean(article.querySelector('.native-controls [data-post-reading-button]')), "Article receives production read-aloud control");
  const button = article.querySelector<HTMLButtonElement>('.native-controls [data-post-reading-button]')!;
  check(button.closest('.native-controls') && !button.closest('h1'), "Speaker belongs to author control row, outside title and body");
  const bounds = button.getBoundingClientRect(), caret = article.querySelector('.native-controls [data-testid="caret"]')!.getBoundingClientRect();
  check(Math.abs((bounds.top+bounds.height/2)-(caret.top+caret.height/2)) <= 1 && bounds.right <= caret.left, "Speaker aligns with native overflow without overlap");
  deliver(); await wait(80); check(article.querySelectorAll('.native-controls [data-post-reading-button]').length === 1 && Boolean(article.querySelector('#embed [data-post-reading-button]')), "Surface redelivery retains one article speaker without stealing embedded controls");
  button.click(); await until(() => utterances.length > 0, "Actual production reader starts speech");
  const player = document.querySelector<HTMLElement>('.post-reading-player[data-visible="true"]')!;
  check(Boolean(player), "Article speaker opens owning player");
  const control = (label: string) => player.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  let active = utterances.at(-1)!;
  check(active.text.includes('First bold paragraph with trailing words.') && !active.text.includes('example.invalid') && !active.text.includes('hidden') && !active.text.includes('invisible'), "Article extraction obeys hyperlink preference and keeps inline prose");
  function boundary(word: string, occurrence = 0): void {
    let index = -1; for (let i=0;i<=occurrence;i++) index = active.text.indexOf(word, index+1);
    check(index >= 0, `Speech contains target ${word}`);
    active.dispatchEvent(new SpeechSynthesisEvent("boundary", { utterance: active, charIndex: index, charLength: word.length, elapsedTime: 0.1 }));
  }
  boundary('trailing');
  check(article.querySelector('[data-post-reading-current-word="true"]')?.textContent === 'trailing', "Native boundary paints exact word after excluded URL and CSS-hidden text");
  await area.set({ includeHyperlinks: true }); await wait(30);
  boundary('trailing');
  check(article.querySelector('[data-post-reading-current-word="true"]')?.textContent === 'trailing', "Changing link preference mid-play preserves current spoken-text mapping");
  check(!article.querySelector('.css-hidden [data-post-reading-word], .css-invisible [data-post-reading-word]'), "CSS-hidden descendants never receive highlight tokens");
  boundary('formatting');
  check(article.querySelector('[data-post-reading-current-word="true"]')?.textContent === 'formatting', "Native boundary stays aligned after collapsed whitespace and inline markup");
  boundary('Repeated', 1);
  check(Boolean(article.querySelector('#fourth [data-post-reading-current-word="true"]')), "Repeated article blocks retain distinct spoken offsets");
  const pauseCount=pauses; control('Pause').click(); check(pauses === pauseCount+1, "Player pause controls active article audio session");
  const resumeCount=resumes; control('Resume').click(); check(resumes === resumeCount+1, "Player resume controls same article audio session");
  const previous = utterances.length;
  control('Previous paragraph').click(); await until(() => utterances.length>previous, "Previous paragraph restarts speech at matching article block");
  active=utterances.at(-1)!; check(active.text.startsWith('Repeated sentence.'), "Article paragraph seek uses displayed block boundary");
  boundary('Repeated');
  await area.set({ bodyHighlightMode: 'smooth' }); await wait(30);
  check(Boolean(article.querySelector('#third [data-post-reading-smooth-word]')), "Settings notification preserves active article highlight targets");
  check(Boolean(article.querySelector('#first strong')) && Boolean(article.querySelector('#second em')), "Article tokenization preserves native rich-text markup");
  const smooth = article.querySelector<HTMLElement>('#third [data-post-reading-smooth-word]')!;
  const fillBefore=smooth.style.getPropertyValue('--post-reading-fill');
  await wait(650);
  check(smooth.style.getPropertyValue('--post-reading-fill') !== fillBefore || smooth.dataset.postReadingSmoothFilled === 'true', "Stalled native boundary falls back to bounded estimated progress");
  const beforeRestart = utterances.length;
  await area.set({ speed: 1.25 });
  await until(() => utterances.length>beforeRestart, "Voice speed change restarts owned audio at current text position");
  active=utterances.at(-1)!; boundary('Repeated');
  check(Boolean(article.querySelector('#third [data-post-reading-smooth-word]')), "Tracking survives settings-driven speech restart");
  const previousForNext=utterances.length;
  control('Next paragraph').click(); await until(() => utterances.length>previousForNext, "Next paragraph controls article speech instead of scanning timeline posts");
  active=utterances.at(-1)!; check(active.text.startsWith('Repeated sentence.'), "Next paragraph uses the next repeated block, not the first text match");
  const stale=utterances[0]; stale.dispatchEvent(new SpeechSynthesisEvent('boundary', {utterance: stale, charIndex: 0, charLength: 5}));
  check(active===utterances.at(-1), "Stale utterance events cannot replace the owning speech session");
  const beforeStop=cancels; control('Quit reading').click(); check(cancels>beforeStop, "Quit stops active article audio");
  await wait(160); check(!article.querySelector('[data-post-reading-word], [data-post-reading-smooth-word]'), "Quit restores original article DOM");
  const countAtQuit=utterances.length; button.click(); await until(() => utterances.length>countAtQuit, "Article can start again after quit");
  active=utterances.at(-1)!;
  check(active.text.includes('https://example.invalid/'), "New explicit article read applies changed hyperlink preference");
  boundary('trailing');
  check(Boolean(article.querySelector('#first a [data-post-reading-smooth-word]')), "Smooth article highlighting includes configured links without flattening their DOM");
  const beforeRoute=cancels; onRouteChange({ previousHref: location.href, href: location.origin + "/home" } as Parameters<typeof onRouteChange>[0]); check(cancels>beforeRoute, "Route change stops active article speech");
  abort.abort(); dispose();
}
run().then(() => { (globalThis as any).__articleReaderResult={passed:true,checks}; }).catch(error => { (globalThis as any).__articleReaderResult={passed:false,checks,error:String(error)}; dispose(); });
