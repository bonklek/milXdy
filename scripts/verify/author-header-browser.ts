import { maintainBadgeTextFlow, markBadgeSlotEmpty, positionBadgeSlotNearTweetTime } from "../../src/apps/remistats/badge-flow";
import badgeCss from "../../src/apps/remistats/remistats.css";
import css from "../../src/platform/visuals/reskin.css";
import scaffoldCss from "../../src/platform/runtime/tweet-scaffold.css";
import { markTweetHeaderScaffold } from "../../src/platform/runtime/tweet-header-scaffold";
const checks: string[] = [];
const check = (value: unknown, label: string) => { if (!value) throw new Error(label); checks.push(label); };
(async () => {
  const style = document.createElement("style"); style.textContent = 'body{font:15px/20px Arial;margin:20px}.native{display:flex;flex-direction:column;min-width:0}.row{display:flex;flex-direction:row;min-width:0;align-items:center}article{padding:12px;border:1px solid #888;margin-bottom:20px}a{color:inherit;text-decoration:none}svg{width:18px;height:18px;fill:#1d9bf0;flex-shrink:0}.metadata{white-space:nowrap}.badge{display:inline-flex;white-space:nowrap;width:88px;height:24px;background:#ddd;color:#222}'; document.head.append(style);
  const production = document.createElement("style"); production.textContent = scaffoldCss + css + badgeCss; document.head.append(production);
  const samples = document.createElement("div"); samples.innerHTML = '<a href="/fixture"><div><span>Name <img role="img" alt="💞" src="data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E"> ending</span><div><svg data-testid="icon-verified"></svg></div></div></a>';
  const sampleArticle = document.createElement("article"); sampleArticle.innerHTML = '<div data-testid="User-Name"></div>'; sampleArticle.firstElementChild!.append(samples.firstElementChild!); document.body.append(sampleArticle);
  markTweetHeaderScaffold(sampleArticle, () => true);
  const emojiOwner = sampleArticle.querySelector('[data-milxdy-display-name-text]')!;
  check(Boolean(emojiOwner.querySelector('img[role="img"]')) && !emojiOwner.querySelector('svg'), "Inline emoji and split text runs stay in complete name owner while verification is excluded");
  const settle = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await verifyUnverifiedNames();
  await verifyAffiliatedNames();
  for (const profile of ["moderate", "max"]) for (const theme of ["light", "dark"]) for (const width of [280, 441, 620]) for (const detail of [false, true]) for (const short of [false, true]) {
    document.documentElement.dataset.milxdyReskinProfile = profile;
    document.documentElement.dataset.milxdySettingsTheme = theme;
    document.body.style.background = theme === "dark" ? "#000" : "#fff"; document.body.style.color = theme === "dark" ? "#eee" : "#111";
    const article = document.createElement("article"); article.dataset.testid = "tweet"; article.style.width = `${width}px`;
    article.innerHTML = `<div class="row" data-testid="User-Name"><div class="row"><div class="native"><a class="native" href="/fixture" role="link"><div class="row"><div dir="ltr" class="row"><span><span>${short ? "Daniel Keller" : "Example very long display name with emoji 💞 and text reaching the edge"}</span></span></div><div dir="ltr" class="row"><span class="row"><svg aria-label="Verified account"><path d="M0 0h18v18H0z"/></svg></span></div></div></a></div></div><div class="row metadata"><div class="row"><div><a href="/fixture"><div><span>@fixture_handle</span></div></a></div>${detail ? "" : '<div>·</div><div><a href="/fixture/status/1"><time>Oct 16</time></a></div>'}</div></div></div><div data-testid="tweetText">Post content remains below its author header.</div>`;
    document.body.replaceChildren(article);
    markTweetHeaderScaffold(article, () => true);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const header = article.querySelector<HTMLElement>('[data-testid="User-Name"]')!, name = article.querySelector<HTMLElement>('[data-milxdy-display-name-text]')!, icon = article.querySelector('svg')!;
    const label = `${profile}/${theme}/${width}/${detail ? "detail" : "feed"}/${short ? "short" : "long"}`;
    check(!name.contains(icon), `${label}: text marker excludes verification subtree`);
    const textRect = name.getBoundingClientRect(), iconRect = icon.getBoundingClientRect();
    check(Math.abs(textRect.top - iconRect.top) <= 3 && textRect.height <= 24, `${label}: name and verified icon stay on one line`);
    check(getComputedStyle(name).whiteSpace === "nowrap" && getComputedStyle(name).textOverflow === "ellipsis", `${label}: complete text owner ellipsizes`);
    check(iconRect.right <= header.getBoundingClientRect().right + 1 && iconRect.width === 18, `${label}: verification stays visible inside header`);
    check(getComputedStyle(article.querySelector('[data-milxdy-metadata-row]')!).display !== "contents", `${label}: metadata remains an independent native row`);
    check(article.scrollWidth <= article.clientWidth + 1, `${label}: no author overflow beyond card`);
    const badge = document.createElement("span"); badge.dataset.reminetBadgeSlot = "true"; badge.dataset.reminetState = "ready"; badge.className = "badge";
    badge.innerHTML = '<span data-reminet-badge>999 · 12345 RP</span>'; badge.style.width = '126px'; header.append(badge); positionBadgeSlotNearTweetTime(article, badge);
    maintainBadgeTextFlow(article, badge); await settle(); await settle();
    const body = article.querySelector<HTMLElement>('[data-testid="tweetText"]')!;
    if (short && detail && width >= 441) check(header.getBoundingClientRect().height <= 28, `${label}: short detail groups naturally fit one row`);
    if (!detail && width >= 441) {
      const handle = article.querySelector<HTMLElement>('[data-milxdy-metadata-row] a[href="/fixture"]')!;
      check(header.getBoundingClientRect().height <= 56, `${label}: typical feed header occupies at most two compact rows`);
      check(Math.abs(handle.getBoundingClientRect().top - badge.getBoundingClientRect().top) <= 4, `${label}: handle and metrics share the second row`);
    }
    check(header.contains(badge) && !body.parentElement?.querySelector('[data-reminet-flow-badge]'), `${label}: production ready badge stays in author header, never beside post text`);
    check(badge.getBoundingClientRect().right <= header.getBoundingClientRect().right + 1 && body.getBoundingClientRect().top >= badge.getBoundingClientRect().bottom - 1, `${label}: metrics stay bounded above post text`);
    article.style.width = "280px"; await settle(); maintainBadgeTextFlow(article, badge); await settle();
    article.style.width = "620px"; await settle(); maintainBadgeTextFlow(article, badge); await settle();
    check(header.contains(badge) && !article.querySelector('[data-reminet-flow-badge]') && badge.getBoundingClientRect().right <= header.getBoundingClientRect().right + 1 && body.getBoundingClientRect().top >= badge.getBoundingClientRect().bottom - 1, `${label}: narrow-to-wide resize retains bounded author-owned metrics above body`);
    markBadgeSlotEmpty(badge); await settle();
    check(!header.querySelector('[data-reminet-badge-row]') && badge.dataset.reminetState === "empty", `${label}: empty badge releases its reserved row`);

  }
  await verifyOccupancy(settle);
  const outer = document.querySelector<HTMLElement>('article[data-testid="tweet"]')!, quote = document.createElement("div"); quote.dataset.testid = "quoteTweet";
  quote.innerHTML = '<div data-testid="User-Name"><a href="/quoted">Quoted author</a><a href="/quoted/status/1"><time>Now</time></a></div>';
  outer.append(quote); const quoteHeader = quote.firstElementChild!;
  const quoteBadge = document.createElement("span"); quoteBadge.dataset.reminetBadgeSlot = "true"; quoteBadge.dataset.reminetState = "ready"; quoteBadge.className = "badge"; quoteBadge.innerHTML = '<span data-reminet-badge>Quoted 12</span>'; quoteHeader.append(quoteBadge); positionBadgeSlotNearTweetTime(quote, quoteBadge);
  maintainBadgeTextFlow(quote, quoteBadge); await settle();
  check(quoteHeader.contains(quoteBadge), "Quoted author metrics remain within their independent header");
  const outerHeader = outer.querySelector<HTMLElement>('[data-testid="User-Name"]')!, ready = outerHeader.querySelector<HTMLElement>('[data-reminet-badge-slot]')!;
  ready.dataset.reminetState = "ready"; ready.removeAttribute("aria-hidden"); ready.innerHTML = '<span data-reminet-badge>999 · 12345 RP</span>'; maintainBadgeTextFlow(outer, ready); await settle();
  check(outerHeader.contains(ready) && quoteHeader.contains(quoteBadge), "Outer and quoted ready badges never share an author row");
  document.body.style.minHeight = "0";
  Object.assign(globalThis, { __authorHeaderResult: { passed: true, checks } });
})().catch(error => { Object.assign(globalThis, { __authorHeaderResult: { passed: false, checks, error: String(error) } }); });

async function verifyOccupancy(settle: () => Promise<void>): Promise<void> {
  const article = document.querySelector<HTMLElement>('article[data-testid="tweet"]')!;
  const header = article.querySelector<HTMLElement>('[data-testid="User-Name"]')!;
  const name = header.querySelector<HTMLElement>('[data-milxdy-display-name-text]')!;
  const metadata = header.querySelector<HTMLElement>('[data-milxdy-metadata-row]')!;
  const badge = header.querySelector<HTMLElement>('[data-reminet-badge-slot]')!;
  article.style.width = "441px"; name.textContent = "Daniel Keller";
  metadata.innerHTML = '<a href="/fixture">@d___k</a>'; badge.dataset.reminetState = "ready"; badge.removeAttribute("aria-hidden"); badge.innerHTML = '<span data-reminet-badge style="display:inline-block;min-width:95px">638408</span>'; badge.style.width = "95px";
  maintainBadgeTextFlow(article, badge); await settle(); await settle();
  const aligned = () => Math.max(...[name, metadata, badge].map(el => el.getBoundingClientRect().top)) - Math.min(...[name, metadata, badge].map(el => el.getBoundingClientRect().top)) <= 4;
  check(aligned() && header.getBoundingClientRect().height <= 28, "Short detail name, verification, handle and metrics occupy one measured row at441px");
  let moves = 0; const observer = new MutationObserver(records => { moves += records.filter(record => record.type === "childList").length; });
  observer.observe(header, { subtree: true, childList: true });
  for (let i = 0; i < 5; i++) { positionBadgeSlotNearTweetTime(article, badge); maintainBadgeTextFlow(article, badge); await settle(); }
  check(moves === 0, "Repeated native badge positioning and packing do not move settled detail DOM"); observer.disconnect();
  name.textContent = "A very long display name with complete emoji 💞 that cannot fit in a single row";
  await settle();
  check(header.getBoundingClientRect().height <= 56 && Math.abs(metadata.getBoundingClientRect().top - badge.getBoundingClientRect().top) <= 4, "Name text mutation selects two rows without changing fixed header width");
  article.style.width = "150px"; await settle();
  check(header.getBoundingClientRect().height > 56, `Third row is reserved for genuinely insufficient metadata-plus-metrics width (header${header.getBoundingClientRect().width}x${header.getBoundingClientRect().height}, meta${metadata.getBoundingClientRect().width}, badge${badge.getBoundingClientRect().width})`);
  article.style.width = "620px"; name.textContent = "Daniel Keller"; await settle();
  check(aligned(), "Widening and shortening the name repacks one row");
  badge.firstElementChild!.setAttribute("style", "display:inline-block;min-width:520px"); await settle();
  check(header.getBoundingClientRect().height <= 56, "Metric width updates recompute occupancy");
  badge.firstElementChild!.setAttribute("style", "display:inline-block;min-width:95px"); name.style.fontSize = "35px"; await settle();
  check(header.getBoundingClientRect().height <= 56, "Font metrics remain bounded by the same intrinsic packing policy");
  name.style.fontSize = ""; await settle(); const before = header.getBoundingClientRect().height; await settle(); await settle();
  check(header.getBoundingClientRect().height === before, "Repeated layout frames do not oscillate occupancy");
}

async function verifyUnverifiedNames(): Promise<void> {
  for (const profile of ["moderate", "max"]) for (const emoji of [false, true]) {
    document.documentElement.dataset.milxdyReskinProfile = profile;
    const article = document.createElement("article"); article.dataset.testid = "tweet"; article.style.width = "620px";
    article.innerHTML = `<div class="row" data-testid="User-Name"><div class="row"><div class="native"><a class="native" href="/fixture" role="link"><div class="row"><div style="line-height:20px"><span><span>Example name${emoji ? ' <img role="img" alt="💞" style="width:16px;height:16px" src="data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E"> ending' : ""}</span></span></div><div data-empty-status style="height:18px;line-height:18px"><span></span></div></div></a></div></div><div class="row metadata"><div class="row"><a href="/fixture"><span>@fixture_handle</span></a><span>·</span><a href="/fixture/status/1"><time>Oct 16</time></a></div></div></div><div data-testid="tweetText">Post content stays below the compact author row.</div>`;
    document.body.replaceChildren(article); markTweetHeaderScaffold(article, () => true);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const header = article.querySelector<HTMLElement>('[data-testid="User-Name"]')!;
    const name = header.querySelector<HTMLElement>('[data-milxdy-display-name-text]')!;
    const handle = header.querySelector<HTMLElement>('[data-milxdy-metadata-row] a span')!;
    const label = `${profile}/unverified/${emoji ? "emoji" : "plain"}`;
    check(!name.querySelector('[data-empty-status]'), `${label}: empty status wrapper is excluded from text ownership`);
    check(Math.abs(name.getBoundingClientRect().top - handle.getBoundingClientRect().top) <= 3, `${label}: display name and handle align on the same line`);
    check(header.getBoundingClientRect().height <= 24, `${label}: empty status wrapper creates no extra author line`);
    if (emoji) check(name.contains(header.querySelector('img')) && name.textContent?.includes("ending"), `${label}: complete name and image emoji stay together`);
  }
}

async function verifyAffiliatedNames(): Promise<void> {
  for (const profile of ["moderate", "max"]) for (const width of [280, 620]) {
    document.documentElement.dataset.milxdyReskinProfile = profile;
    const article = document.createElement("article"); article.dataset.testid = "tweet"; article.style.width = `${width}px`;
    article.innerHTML = `<div class="row" data-testid="User-Name"><div class="row"><div class="native"><a class="native" href="/fixture"><div class="native"><div><span>Example author 🪲</span></div><div data-native-status class="row"><span class="row"><svg aria-label="Verified account"></svg><div role="link"><img alt="" style="width:18px;height:18px" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"></div></span></div></div></a></div></div><div class="row metadata"><a href="/fixture"><span>@fixture</span></a></div></div>`;
    document.body.replaceChildren(article); markTweetHeaderScaffold(article, () => true);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const name = article.querySelector<HTMLElement>('[data-milxdy-display-name-text]')!;
    const handle = article.querySelector<HTMLElement>('[data-milxdy-metadata-row] span')!;
    const icon = article.querySelector('svg')!;
    const label = `${profile}/${width}/affiliated`;
    check(!name.querySelector('[data-native-status]'), `${label}: affiliation image is excluded from name ownership`);
    check(Math.abs(name.getBoundingClientRect().top - handle.getBoundingClientRect().top) <= 3, `${label}: name and handle align`);
    check(Math.abs(name.getBoundingClientRect().top - icon.getBoundingClientRect().top) <= 3, `${label}: verification stays beside name`);
  }
}
