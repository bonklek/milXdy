import { boot, dispose, onSurface } from "../../src/apps/post-reading/content";
import { readerShareMenuFixture, openReaderShareMenu } from "./reader-share-menu-fixture";
import { createReadAloudButton } from "../../src/apps/post-reading/read-button";
import { reviewPostAudio } from "../../src/apps/post-reading/post-audio-action";
import { DEFAULT_SETTINGS } from "../../src/apps/post-reading/shared/defaults";
import readerCss from "../../src/apps/post-reading/post-reading.css";
import scaffoldCss from "../../src/platform/runtime/tweet-scaffold.css";
import reskinCss from "../../src/platform/visuals/reskin.css";
const checks: string[] = [];
function check(value: unknown, label: string): void { if (!value) throw new Error(label); checks.push(label); }
async function run(): Promise<void> {
  await verifyLongPostReadButtons();
  const style = document.createElement("style");
  style.textContent = 'body{font:15px Arial;margin:20px}.controls{display:flex;align-items:center;justify-content:space-between;height:34px;margin:30px 0}.native{width:22px;height:20px;flex:none}'+readerCss+scaffoldCss+reskinCss;
  document.head.append(style);
  let reads = 0, bubbles = 0, requests = 0;
  for (const theme of ["light", "dark"]) for (const width of [280, 441, 620]) for (const header of [true, false]) {
    document.documentElement.dataset.milxdySettingsTheme = theme;
    const row = document.createElement("div"); row.className = "controls"; row.style.width = `${width}px`;
    row.innerHTML = '<button class="native" aria-label="Grok actions">G</button><span data-post-reading-button-slot="true" class="post-reading-button-slot"></span><button class="native" data-testid="caret" aria-label="More">…</button>';
    const slot = row.querySelector<HTMLElement>("span")!;
    if (header) { slot.classList.add("post-reading-button-slot--header"); slot.dataset.milxdyTweetSlot = "post-reading-header-action"; row.dataset.milxdyPostReadingHeaderControls = "true"; }
    const read = createReadAloudButton(() => reads++); slot.append(read); row.onclick = () => bubbles++; document.body.replaceChildren(row);
    const rect = read.getBoundingClientRect(), bounds = slot.getBoundingClientRect();
    const label = `${theme}/${width}/${header ? "header" : "footer"}`;
    check(row.querySelectorAll(".post-reading-button").length === 1 && !row.querySelector('[data-post-reading-export-button]'), `${label}: single speaker, no competing MP3 button`);
    check(read.querySelector('path')?.getAttribute('d') === "M11 5 6 9H3v6h3l5 4V5Z", `${label}: original speaker icon preserved`);
    if (header) check(bounds.width === 22 && rect.left >= bounds.left && rect.right <= bounds.right && rect.height === 20, `${label}: speaker fits reserved 22px slot without extra height`);
    for (const native of row.querySelectorAll<HTMLButtonElement>(".native")) { const n = native.getBoundingClientRect(); check(rect.right <= n.left || rect.left >= n.right, `${label}: speaker does not collide with ${native.ariaLabel}`); }
    check(document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2) === read, `${label}: speaker owns pointer target`);
    read.focus(); check(document.activeElement === read, `${label}: speaker remains keyboard focusable`); read.click();
  }
  check(reads === 12 && bubbles === 0 && requests === 0, "Speaker invokes only read callback without bubbling or conversion");
  const post = document.createElement("article"); post.dataset.testid = "tweet";
  post.innerHTML = '<div data-testid="User-Name">Fixture author</div><a href="https://x.com/fixture/status/1">Date</a><div data-testid="tweetText">Visible reviewed source.</div><div data-testid="quoteTweet"><div data-testid="tweetText">Excluded quote</div></div>';
  document.body.replaceChildren(post);
  const controller = new AbortController(); const context = { actionId:"reviewMp3", post, statusUrl:"https://x.com/fixture/status/1", signal:controller.signal };
  const opened: {close: (() => void) | null} = {close:null};
  const send = async () => { requests++; return { ok:false, error:"Controlled fixture: no network" }; };
  const runtime = await readerShareMenuFixture(selected => { opened.close = reviewPostAudio(selected, {...DEFAULT_SETTINGS, ttsEngine:"custom-http", customTtsEndpoint:"https://fixture.invalid/tts"}, send); });
  const menu = await openReaderShareMenu(post);
  check(menu.textContent === "Export as MP3", "Actual host injects registry-declared Export as MP3 in native Share menu");
  check(!document.querySelector("dialog") && requests === 0, "Share menu entry does not export automatically"); menu.focus(); menu.click();
  for (let i=0; i<100 && !document.querySelector("dialog"); i++) await new Promise(resolve => setTimeout(resolve,20));
  const dialog = document.querySelector<HTMLDialogElement>("dialog")!;
  check(dialog.open && dialog.querySelector("textarea")?.value === "Visible reviewed source.", "Share action opens review for own visible post text");
  check(requests === 0, "Opening review does not request conversion");
  const text = dialog.querySelector("textarea")!; text.value = "Edited explicit review.";
  const generate = Array.from(dialog.querySelectorAll("button")).find(button => button.textContent === "Download as MP3")!; generate.click(); await Promise.resolve();
  check(requests === 1, "Only explicit Download confirmation requests generation"); await runtime.dispose(); controller.abort();
  check(!document.querySelector("dialog"), "App lifecycle abort closes review"); opened.close?.();
  check(reviewPostAudio(context, DEFAULT_SETTINGS, send) === null, "Aborted Share context cannot reopen review");
  const fresh = {...context, signal:new AbortController().signal}; post.querySelector("a")!.href = "https://x.com/fixture/status/2";
  let rejected = false; try { reviewPostAudio(fresh, DEFAULT_SETTINGS, send); } catch { rejected = true; }
  check(rejected && !document.querySelector("dialog"), "Recycled post rejects stale Share selection before review");
  post.remove(); check(reviewPostAudio(fresh, DEFAULT_SETTINGS, send) === null, "Detached post cannot open review");
  document.body.replaceChildren(post); post.querySelector("a")!.href = context.statusUrl;
  reviewPostAudio(fresh, DEFAULT_SETTINGS, send); // Leave a useful controlled review view for screenshots.
}
run().then(() => { (globalThis as any).__readerControlsResult = {passed:true,checks}; }).catch(error => { (globalThis as any).__readerControlsResult = {passed:false,checks,error:String(error)}; });

async function verifyLongPostReadButtons(): Promise<void> {
  await boot({ resolveAssetUrl: () => "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" } as unknown as Parameters<typeof boot>[0]);
  try {
    for (const mode of ["fast", "balanced"]) for (const length of [1000, 2000, 15000]) {
      document.documentElement.dataset.milxdyPerformanceMode = mode;
      const article = document.createElement("article"); article.dataset.testid = "tweet";
      article.innerHTML = '<span data-milxdy-tweet-slot="post-reading-header-action"></span><div data-testid="tweetText"></div>';
      const text = article.querySelector<HTMLElement>('[data-testid="tweetText"]')!; text.textContent = 'Readable long post. '.repeat(Math.ceil(length / 20));
      document.body.replaceChildren(article);
      onSurface({ kind: "tweet", element: article, actionRow: null, textContainers: [text] } as Parameters<typeof onSurface>[0]);
      const deadline = performance.now() + 2000;
      while (!article.querySelector('[data-post-reading-button]') && performance.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
      const button = article.querySelector<HTMLElement>('[data-post-reading-button]');
      check(Boolean(button) && button!.getBoundingClientRect().width > 0 && Boolean(button!.querySelector('svg path')), `${mode}/${length}: long post keeps visible speaker control`);
    }
  } finally { dispose(); }
}
