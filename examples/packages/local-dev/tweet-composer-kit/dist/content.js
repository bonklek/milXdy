// examples/packages/local-dev/tweet-composer-kit/src/content.js
var context = null;
var makers = [
  { label: "#CHEESEWORLD Meme Maker", asset: "assets/makers/cheeseworld.png", theme: "cheeseworld", href: "https://cult.inc/cheeseworld" },
  { label: "Milady Maker", asset: "assets/makers/milady.png", theme: "milady", handoffId: "milady-maker" },
  { label: "Redacted Remilio Babies Maker", asset: "assets/makers/remilio.png", theme: "remilio", handoffId: "remilio-maker" },
  { label: "Bonkler Factory", asset: "assets/makers/bonkler.png", theme: "bonkler", handoffId: "bonkler-maker" },
  { label: "Kagami Academy Maker", asset: "assets/makers/kagami.png", theme: "kagami", handoffId: "kagami-maker" }
];
function boot(nextContext) {
  context = nextContext;
  context.recordDiagnostic("tweet-composer-kit.ready", { capability: "composer-adjacent-panel" });
}
async function onComposerAction({ panel, externalHandoffs, launchExternalHandoff, queryRemoteService, signal }) {
  if (!context || signal.aborted) return;
  panel.replaceChildren(buildControls({ externalHandoffs, launchExternalHandoff, queryRemoteService, signal }));
  signal.addEventListener("abort", () => panel.replaceChildren(), { once: true });
}
function onReplyAction({ panel, templates, selectTemplate, openNativeReply, close, signal }) {
  if (!context || signal.aborted) return;
  const menuTemplates = Array.isArray(templates) ? templates.filter((template) => template && typeof template.id === "string" && template.id.length > 0) : [];
  const root = el("section", { className: "tweet-composer-kit tweet-composer-kit__reply-menu", ariaLabel: "Composer Kit quick reply" });
  const status = el("p", { className: "tweet-composer-kit__status", ariaLive: "polite", role: "status" });
  const rows = el("div", { className: "tweet-composer-kit__reply-rows", role: "menu", ariaLabel: "Quick reply choices" });
  const buttons = [];
  const makeRow = ({ label, iconPath, action, primary = false }) => {
    const button = el(
      "button",
      { className: `tweet-composer-kit__reply-row${primary ? " tweet-composer-kit__reply-row--primary" : ""}`, type: "button", role: "menuitem" },
      replyIcon(iconPath),
      el("span", { className: "tweet-composer-kit__reply-copy" }, el("strong", { textContent: label }))
    );
    button.addEventListener("click", async () => {
      if (signal.aborted) return;
      buttons.forEach((entry) => {
        entry.disabled = true;
      });
      try {
        await action();
      } catch {
        if (!signal.aborted) {
          buttons.forEach((entry) => {
            entry.disabled = false;
          });
          status.textContent = "Quick reply could not open. Try again.";
        }
      }
    }, { signal });
    buttons.push(button);
    rows.append(button);
  };
  root.append(rows, status);
  makeRow({ label: "Send a reply", iconPath: "assets/reply-arrow.svg", action: () => openNativeReply() });
  for (const template of menuTemplates) {
    makeRow({
      label: template.label || template.id,
      iconPath: "assets/reply-lightning.svg",
      primary: template.id !== "custom",
      action: async () => {
        status.textContent = `Opening ${template.label || template.id} quick reply...`;
        await selectTemplate(template.id);
      }
    });
  }
  if (!menuTemplates.length) rows.append(el("p", { className: "tweet-composer-kit__empty", textContent: "No local quick replies are available." }));
  panel.replaceChildren(root);
  signal.addEventListener("abort", () => panel.replaceChildren(), { once: true });
}
function buildControls({ externalHandoffs, launchExternalHandoff, queryRemoteService, signal }) {
  const root = el("section", { className: "tweet-composer-kit tweet-composer-kit__composer-panel", ariaLabel: "Tweet Composer Kit" });
  const topInput = el("input", { className: "tweet-composer-kit__caption-input", type: "text", maxLength: 280, placeholder: "Top text", ariaLabel: "Top text", autocomplete: "off" });
  const bottomInput = el("input", { className: "tweet-composer-kit__caption-input", type: "text", maxLength: 280, placeholder: "Bottom text", ariaLabel: "Bottom text", autocomplete: "off" });
  const random = el("input", { id: "tweet-composer-kit-random-meme", className: "tweet-composer-kit__random-toggle", type: "checkbox" });
  root.append(
    el("div", { className: "tweet-composer-kit__caption-fields" }, topInput, bottomInput),
    buildMemeControls(random),
    buildMakerRow({ externalHandoffs, launchExternalHandoff, random, topInput, bottomInput, signal }),
    buildMediaPicker({ queryRemoteService, signal }),
    buildContributionHandoff({ signal })
  );
  return root;
}
function buildContributionHandoff({ signal }) {
  const root = el("section", { className: "tweet-composer-kit__contribution", ariaLabel: "Contribute to Remibooru" });
  const rights = el("input", { id: "tweet-composer-kit-remibooru-rights", className: "tweet-composer-kit__contribution-check", type: "checkbox" });
  const status = el("p", { className: "tweet-composer-kit__contribution-status", role: "status", ariaLive: "polite" });
  const open = el("a", {
    className: "tweet-composer-kit__contribution-open",
    href: "https://remibooru.com/upload",
    target: "_blank",
    rel: "noopener noreferrer",
    textContent: "Open native upload"
  });
  open.addEventListener("click", (event) => {
    if (rights.checked) return;
    event.preventDefault();
    status.textContent = "Confirm that you have the right to contribute before opening the public uploader.";
  }, { signal });
  rights.addEventListener("change", () => {
    status.textContent = "";
  }, { signal });
  root.append(
    el("strong", { className: "tweet-composer-kit__contribution-title", textContent: "Contribute to Remibooru" }),
    el("p", { className: "tweet-composer-kit__contribution-copy", textContent: "Public upload. Composer Kit transfers no image, tag, account, or draft data; select media, tags, and final publish in Remibooru." }),
    el("label", { className: "tweet-composer-kit__contribution-rights", htmlFor: rights.id }, rights, el("span", { textContent: "I have the right to contribute this media publicly." })),
    open,
    status
  );
  return root;
}
function buildMediaPicker({ queryRemoteService, signal }) {
  const root = el("section", { className: "tweet-composer-kit__media-picker", ariaLabel: "Remibooru reaction media" });
  const facets = el("input", { className: "tweet-composer-kit__media-query", type: "search", maxLength: 160, placeholder: "Search Remibooru tags", ariaLabel: "Search Remibooru tags", autocomplete: "off" });
  const recent = el("button", { className: "tweet-composer-kit__media-button", type: "button", textContent: "Recent" });
  const search = el("button", { className: "tweet-composer-kit__media-button", type: "button", textContent: "Search" });
  const tags = el("button", { className: "tweet-composer-kit__media-button", type: "button", textContent: "Tags" });
  const results = el("div", { className: "tweet-composer-kit__media-results", role: "list", ariaLabel: "Remibooru results" });
  const facetList = el("div", { className: "tweet-composer-kit__media-facets", ariaLabel: "Remibooru tags" });
  const more = el("button", { className: "tweet-composer-kit__media-more", type: "button", textContent: "More", hidden: true });
  const status = el("p", { className: "tweet-composer-kit__media-status", role: "status", ariaLive: "polite" });
  const available = typeof queryRemoteService === "function";
  let nextCursor = null;
  const setBusy = (busy) => {
    root.toggleAttribute("data-busy", busy);
    root.setAttribute("aria-busy", String(busy));
    recent.disabled = busy || !available;
    search.disabled = busy || !available;
    tags.disabled = busy || !available;
    more.disabled = busy || !available;
  };
  const render = (items, replace) => {
    if (replace) results.replaceChildren();
    const safeItems = Array.isArray(items) ? items.filter(isRemibooruResult) : [];
    for (const item of safeItems) {
      const thumbnail = el("img", { className: "tweet-composer-kit__media-thumb", src: item.thumbnailUrl, alt: "", ariaHidden: "true" });
      const attribution = el("span", { className: "tweet-composer-kit__media-attribution", textContent: "Remibooru" });
      results.append(el("a", {
        className: "tweet-composer-kit__media-item",
        href: item.postUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        role: "listitem",
        ariaLabel: "Open this Remibooru post",
        title: "Open on Remibooru"
      }, thumbnail, attribution));
    }
    if (!results.childElementCount) status.textContent = "No matching Remibooru media was found.";
  };
  const load = async ({ cursor = null, recentOnly = false } = {}) => {
    if (!available || signal.aborted) return;
    const parsedFacets = recentOnly ? [] : parseRemibooruFacets(facets.value);
    setBusy(true);
    status.textContent = recentOnly ? "Loading recent Remibooru media..." : "Searching Remibooru...";
    try {
      const result = await queryRemoteService("remibooru-reactions", {
        resource: "posts",
        limit: 12,
        facets: parsedFacets,
        ...cursor ? { cursor } : {}
      });
      if (!result?.ok || !result.page) throw new Error(result?.error || "Remibooru is unavailable.");
      if (signal.aborted) return;
      render(result.page.items, !cursor);
      nextCursor = typeof result.page.nextCursor === "string" && result.page.nextCursor ? result.page.nextCursor : null;
      more.hidden = !nextCursor;
      if (results.childElementCount) status.textContent = "Remibooru results. Select one to open its canonical post.";
    } catch {
      if (!signal.aborted) {
        more.hidden = true;
        status.textContent = "Remibooru is unavailable. Try again.";
      }
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  };
  recent.addEventListener("click", () => void load({ recentOnly: true }), { signal });
  search.addEventListener("click", () => void load(), { signal });
  tags.addEventListener("click", async () => {
    if (!available || signal.aborted) return;
    setBusy(true);
    status.textContent = "Loading Remibooru tags...";
    try {
      const result = await queryRemoteService("remibooru-reactions", { resource: "facets" });
      if (!result?.ok || !Array.isArray(result.facets)) throw new Error(result?.error || "Remibooru is unavailable.");
      if (signal.aborted) return;
      facetList.replaceChildren(...result.facets.slice(0, 12).filter((facet) => facet && typeof facet.value === "string").map((facet) => {
        const choice = el("button", { className: "tweet-composer-kit__media-facet", type: "button", textContent: facet.value, title: `${facet.postCount || 0} posts` });
        choice.addEventListener("click", () => {
          facets.value = facet.value;
          void load();
        }, { signal });
        return choice;
      }));
      status.textContent = facetList.childElementCount ? "Choose a Remibooru tag to search." : "No Remibooru tags are available.";
    } catch {
      if (!signal.aborted) status.textContent = "Remibooru tags are unavailable. Try again.";
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }, { signal });
  facets.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void load();
  }, { signal });
  more.addEventListener("click", () => void load({ cursor: nextCursor }), { signal });
  root.append(el("div", { className: "tweet-composer-kit__media-controls" }, facets, recent, search, tags), facetList, results, more, status);
  if (!available) {
    status.textContent = "Remibooru search is not available in this build.";
    setBusy(false);
  }
  return root;
}
function parseRemibooruFacets(value) {
  return String(value || "").split(/[\s,]+/).map((facet) => facet.trim()).filter(Boolean).slice(0, 5).map((facet) => facet.slice(0, 60));
}
function isRemibooruResult(item) {
  return Boolean(item && typeof item.postUrl === "string" && item.postUrl.startsWith("https://remibooru.com/posts/") && typeof item.thumbnailUrl === "string" && item.thumbnailUrl.startsWith("https://remibooru.com/media/thumbs/"));
}
function buildMemeControls(random) {
  const tooltipId = "tweet-composer-kit-meme-help";
  const info = el(
    "button",
    { className: "tweet-composer-kit__info", type: "button", ariaLabel: "How meme this post works", ariaDescribedBy: tooltipId, textContent: "i" },
    el("span", { id: tooltipId, className: "tweet-composer-kit__tooltip", role: "tooltip", textContent: "Choose a maker. Captioned sends the Top text and Bottom text you enter; random meme permits both fields to be empty and asks for an uncaptioned random output. CHEESEWORLD stays a normal link." })
  );
  return el(
    "div",
    { className: "tweet-composer-kit__meme-controls" },
    el("label", { className: "tweet-composer-kit__random-label", htmlFor: random.id }, random, el("span", { textContent: "random meme?" })),
    info
  );
}
function buildMakerRow({ externalHandoffs, launchExternalHandoff, random, topInput, bottomInput, signal }) {
  const root = el("div", { className: "tweet-composer-kit__maker-group" });
  const list = el("div", { className: "tweet-composer-kit__maker-row", ariaLabel: "Maker destinations" });
  const status = el("p", { className: "tweet-composer-kit__maker-status", role: "status", ariaLive: "polite" });
  const available = new Set(Array.isArray(externalHandoffs) ? externalHandoffs.map((action) => action && action.id) : []);
  for (const maker of makers) {
    const className = `tweet-composer-kit__maker tweet-composer-kit__maker--${maker.theme}`;
    const image = el("img", { className: "tweet-composer-kit__maker-thumb", src: context.resolveAssetUrl(maker.asset), alt: "", ariaHidden: "true" });
    if (maker.href) {
      list.append(el("a", { className, href: maker.href, target: "_blank", rel: "noopener noreferrer", ariaLabel: maker.label, title: maker.label }, image));
      continue;
    }
    const action = el("button", { className, type: "button", ariaLabel: maker.label, title: maker.label, disabled: typeof launchExternalHandoff !== "function" || !available.has(maker.handoffId) }, image);
    action.addEventListener("click", async () => {
      if (signal.aborted || action.disabled) return;
      setMakerBusy(list, action, true);
      status.textContent = `${maker.label} is preparing an image\u2026`;
      try {
        await launchExternalHandoff(maker.handoffId, {
          mode: random.checked ? "randomMeme" : "captioned",
          captions: { topText: topInput.value, bottomText: bottomInput.value }
        });
        if (!signal.aborted) status.textContent = `${maker.label} handoff complete. Check the active composer.`;
      } catch {
        if (!signal.aborted) status.textContent = `${maker.label} could not open. Try again.`;
      } finally {
        if (!signal.aborted) setMakerBusy(list, action, false);
      }
    }, { signal });
    list.append(action);
  }
  root.append(list, status);
  return root;
}
function setMakerBusy(list, activeAction, busy) {
  list.classList.toggle("is-busy", busy);
  list.setAttribute("aria-busy", String(busy));
  for (const control of list.children) {
    const active = control === activeAction;
    control.classList.toggle("is-loading", busy && active);
    if (control.tagName === "BUTTON") {
      if (busy) {
        control.dataset.tckWasDisabled = String(control.disabled);
        control.disabled = true;
      } else {
        control.disabled = control.dataset.tckWasDisabled === "true";
        delete control.dataset.tckWasDisabled;
      }
      continue;
    }
    if (busy) {
      control.dataset.tckTabindex = control.getAttribute("tabindex") || "";
      control.setAttribute("tabindex", "-1");
      control.setAttribute("aria-disabled", "true");
    } else {
      const previousTabindex = control.dataset.tckTabindex;
      if (previousTabindex) control.setAttribute("tabindex", previousTabindex);
      else control.removeAttribute("tabindex");
      control.removeAttribute("aria-disabled");
      delete control.dataset.tckTabindex;
    }
  }
}
function replyIcon(path) {
  const image = el("img", { className: "tweet-composer-kit__reply-icon", alt: "", ariaHidden: "true" });
  image.src = context.resolveAssetUrl(path);
  return image;
}
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}
export {
  boot,
  onComposerAction,
  onReplyAction
};
