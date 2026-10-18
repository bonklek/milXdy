import reskinCss from "../../src/platform/visuals/reskin.css";
const checks: string[] = [];
const check = (value: unknown, label: string) => { if (!value) throw new Error(label); checks.push(label); };
(async () => {
  document.head.insertAdjacentHTML("beforeend", '<style>body{margin:0}#site-layout{display:flex;align-items:flex-start;width:1200px}#site-header{display:block;width:260px;flex:none}#site-header nav{display:flex;flex-direction:column}#site-header nav a{display:block;height:45px}#site-main{display:block;width:700px}#primary-column{display:flex;flex-direction:column;width:680px;min-height:400px}article{display:block;width:620px;padding:16px}#feed-post{display:block;min-height:160px}.native-identity{display:flex;min-height:24px}svg{width:24px;height:24px}</style>');
  document.body.innerHTML = '<div id="site-layout"><header id="site-header" role="banner"><h1><a href="/home" aria-label="X" role="link"><svg viewBox="0 0 24 24"><path d="M2 2 22 22M22 2 2 22"/></svg></a></h1><nav><a data-testid="AppTabBar_Home_Link" href="/home"><div>Home</div></a><a data-testid="AppTabBar_Notifications_Link" href="/notifications"><div>Notifications</div></a></nav></header><main id="site-main" role="main"><div id="primary-column" data-testid="primaryColumn"><div id="timeline"><article data-testid="tweet" id="feed-post"><div data-testid="User-Name" class="native-identity"><div><a href="/fixture"><span>Example display name</span></a></div><div><div><a href="/fixture/status/1"><time>Now</time></a></div></div></div><div data-testid="tweetText">The feed remains in its native layout while author headers receive scoped styling.</div></article></div></div><div id="outside-author-header"><time>Unrelated timestamp</time><div>Native status</div></div></main></div>';
  const baselineHeaderWidth = document.getElementById("site-header")!.getBoundingClientRect().width;
  const baselineMainWidth = document.getElementById("site-main")!.getBoundingClientRect().width;
  const production = document.createElement("style"); production.textContent = reskinCss; document.head.append(production);
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  const primary = document.getElementById("primary-column")!, header = document.getElementById("site-header")!, main = document.getElementById("site-main")!;
  for (const profile of ["moderate", "max", "min"]) {
    document.documentElement.dataset.milxdyReskinProfile = profile;
    check(getComputedStyle(primary).display === "flex" && primary.getBoundingClientRect().height >= 400, `${profile}: primary column retains native display:flex and height (actual display:${getComputedStyle(primary).display})`);
    check(header.getBoundingClientRect().height < 300 && header.getBoundingClientRect().width === baselineHeaderWidth && main.getBoundingClientRect().width === baselineMainWidth && main.getBoundingClientRect().left === header.getBoundingClientRect().right, `${profile}: navigation remains narrow and main remains visible`);
    check(document.getElementById("feed-post")!.getBoundingClientRect().height >= 160, `${profile}: feed post remains visible`);
    const nav = header.querySelector("nav")!, links = nav.querySelectorAll("a");
    check(getComputedStyle(nav).display === "flex" && links[1].getBoundingClientRect().top > links[0].getBoundingClientRect().top && nav.getBoundingClientRect().right <= header.getBoundingClientRect().right, `${profile}: native navigation stays within its original column`);
    check(getComputedStyle(document.getElementById("outside-author-header")!).display === "block", `${profile}: an unrelated main timestamp never receives author-header layout`);
  }
  check(!/\$\{|\b(?:export\s+const|const\s+\w+\s*=)|`/u.test(reskinCss), "Production CSS contains no JavaScript or unresolved template interpolation");
  const rules = Array.from(production.sheet!.cssRules).filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && rule.style.display === "contents");
  check(rules.every(rule => rule.selectorText.includes('article[data-testid="tweet"]') && rule.selectorText.includes('[data-testid="User-Name"]')), "Every display:contents rule is explicitly scoped to tweet author headers");
  const regression = document.createElement("style"); regression.textContent = ':has(time) > div:last-child div:not([class*="reminet-"]):not([class*="miladymaxxer"]) { display:contents!important }'; document.head.append(regression);
  check(getComputedStyle(primary).display === "contents", "Native-layout fixture reproduces the reported unscoped selector regression");
  regression.remove();
  check(getComputedStyle(primary).display === "flex", "Removing the unscoped regression restores primary-column layout");
  document.documentElement.dataset.milxdyReskinProfile = "moderate";
  Object.assign(globalThis, { __reskinLayoutResult: { passed: true, checks } });
})().catch(error => { Object.assign(globalThis, { __reskinLayoutResult: { passed: false, checks, error: String(error), cssHasInterpolation: reskinCss.includes("${"), primaryDisplay: getComputedStyle(document.getElementById("primary-column")!).display, layout: ["site-header", "site-main", "primary-column"].map(id => { const box = document.getElementById(id)!.getBoundingClientRect(); return { id, x: box.x, width: box.width, height: box.height }; }), contents: Array.from(document.styleSheets).flatMap(sheet => Array.from(sheet.cssRules)).filter(rule => rule instanceof CSSStyleRule && rule.style.display === "contents").map(rule => ({ css: rule.cssText, parent: (rule as CSSStyleRule).parentRule?.cssText.slice(0,200), matchesPrimary: document.getElementById("primary-column")!.matches((rule as CSSStyleRule).selectorText), matches: Array.from(document.querySelectorAll((rule as CSSStyleRule).selectorText)).map(el => el.id || el.tagName) })) } }); });
