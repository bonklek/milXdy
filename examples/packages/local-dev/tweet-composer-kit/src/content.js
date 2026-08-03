/** Authored against the public milXdy App SDK and bundled for local review. */

let context = null;

const makers = [
  { label: "#CHEESEWORLD Meme Maker", asset: "assets/makers/cheeseworld.png", theme: "cheeseworld", handoffId: "cheeseworld-deepfry" },
  { label: "Milady Maker", asset: "assets/makers/milady.png", theme: "milady", handoffId: "milady-maker" },
  { label: "Redacted Remilio Babies Maker", asset: "assets/makers/remilio.png", theme: "remilio", handoffId: "remilio-maker" },
  { label: "Bonkler Factory", asset: "assets/makers/bonkler.png", theme: "bonkler", handoffId: "bonkler-maker" },
  { label: "Kagami Academy Maker", asset: "assets/makers/kagami.png", theme: "kagami", handoffId: "kagami-maker" },
];

export function boot(nextContext) {
  context = nextContext;
  context.recordDiagnostic("tweet-composer-kit.ready", { capability: "composer-adjacent-panel" });
}

export async function onComposerAction({ panel, externalHandoffs, launchExternalHandoff, queryRemoteService, suggestRemoteQueryFacets, attachRemoteQueryResult, signal }) {
  if (!context || signal.aborted) return;
  panel.replaceChildren(buildControls({ externalHandoffs, launchExternalHandoff, queryRemoteService, suggestRemoteQueryFacets, attachRemoteQueryResult, signal }));
  signal.addEventListener("abort", () => panel.replaceChildren(), { once: true });
}

export function onReplyAction({ panel, templates, selectTemplate, openNativeReply, close, signal }) {
  if (!context || signal.aborted) return;
  const menuTemplates = Array.isArray(templates)
    ? templates.filter((template) => template && typeof template.id === "string" && template.id.length > 0)
    : [];
  const root = el("section", { className: "tweet-composer-kit tweet-composer-kit__reply-menu", ariaLabel: "Post-Factory quick reply" });
  const status = el("p", { className: "tweet-composer-kit__status", ariaLive: "polite", role: "status" });
  const rows = el("div", { className: "tweet-composer-kit__reply-rows", role: "menu", ariaLabel: "Quick reply choices" });
  const buttons = [];
  const makeRow = ({ label, iconPath, action, primary = false }) => {
    const button = el("button", { className: `tweet-composer-kit__reply-row${primary ? " tweet-composer-kit__reply-row--primary" : ""}`, type: "button", role: "menuitem" },
      replyIcon(iconPath),
      el("span", { className: "tweet-composer-kit__reply-copy" }, el("strong", { textContent: label })),
    );
    button.addEventListener("click", async () => {
      if (signal.aborted) return;
      buttons.forEach((entry) => { entry.disabled = true; });
      try {
        await action();
      } catch {
        if (!signal.aborted) {
          buttons.forEach((entry) => { entry.disabled = false; });
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
      },
    });
  }
  if (!menuTemplates.length) rows.append(el("p", { className: "tweet-composer-kit__empty", textContent: "No local quick replies are available." }));
  panel.replaceChildren(root);
  signal.addEventListener("abort", () => panel.replaceChildren(), { once: true });
}

function buildControls({ externalHandoffs, launchExternalHandoff, queryRemoteService, suggestRemoteQueryFacets, attachRemoteQueryResult, signal }) {
  const root = el("section", { className: "tweet-composer-kit tweet-composer-kit__composer-panel", ariaLabel: "Post-Factory" });
  const topInput = el("input", { className: "tweet-composer-kit__caption-input", type: "text", maxLength: 280, placeholder: "Top text", ariaLabel: "Top text", autocomplete: "off" });
  const bottomInput = el("input", { className: "tweet-composer-kit__caption-input", type: "text", maxLength: 280, placeholder: "Bottom text", ariaLabel: "Bottom text", autocomplete: "off" });
  const random = el("input", { id: "tweet-composer-kit-random-meme", className: "tweet-composer-kit__random-toggle", type: "checkbox" });
  root.append(
    el("div", { className: "tweet-composer-kit__caption-fields" }, topInput, bottomInput),
    buildMemeControls(random),
    buildMakerRow({ externalHandoffs, launchExternalHandoff, random, topInput, bottomInput, signal }),
    buildMediaPicker({ queryRemoteService, suggestRemoteQueryFacets, attachRemoteQueryResult, signal }),
  );
  return root;
}

export function onContextMediaAction({ actionId, panel, signal, mediaHandle, media, openVisibleAssistantPrompt, submitMediaContribution }) {
  if (!context || signal.aborted) return;
  if (actionId !== "remibooru-contribute") {
    panel.replaceChildren(el("p", { className: "tweet-composer-kit__contribution-status", role: "status", textContent: "This media action is unavailable." }));
    return;
  }
  const tags = [];
  const root = el("section", { className: "tweet-composer-kit__contribution", ariaLabel: "Publish to public Remibooru" });
  const title = el("strong", { className: "tweet-composer-kit__contribution-title", textContent: "Publish to public Remibooru" });
  const dimensions = Number.isFinite(media.width) && Number.isFinite(media.height) ? ` · ${media.width} × ${media.height}` : "";
  const details = el("p", { className: "tweet-composer-kit__contribution-copy", textContent: `Selected image · ${media.mimeType || "image"}${dimensions}` });
  const input = el("input", { className: "tweet-composer-kit__contribution-input", type: "text", maxLength: 64, placeholder: "Add a tag", ariaLabel: "Add a Remibooru tag", autocomplete: "off" });
  const add = el("button", { className: "tweet-composer-kit__contribution-button", type: "button", textContent: "Add" });
  const tagList = el("div", { className: "tweet-composer-kit__contribution-tags", role: "list", ariaLabel: "Contribution tags" });
  const assistant = el("button", { className: "tweet-composer-kit__contribution-button", type: "button", textContent: "Get tag ideas in Grok" });
  const contribute = el("button", { className: "tweet-composer-kit__contribution-button tweet-composer-kit__contribution-button--primary", type: "button", textContent: "Publish to Remibooru" });
  const nativeFallback = el("a", { className: "tweet-composer-kit__contribution-link", href: "https://remibooru.com/upload", target: "_blank", rel: "noopener noreferrer", textContent: "Open native uploader" });
  const status = el("p", { className: "tweet-composer-kit__contribution-status", role: "status", ariaLive: "polite" });
  const renderTags = () => {
    tagList.replaceChildren(...tags.map((tag) => {
      const remove = el("button", { className: "tweet-composer-kit__contribution-tag", type: "button", textContent: `× ${tag}`, ariaLabel: `Remove tag ${tag}` });
      remove.addEventListener("click", () => { tags.splice(tags.indexOf(tag), 1); renderTags(); }, { signal });
      return remove;
    }));
    contribute.disabled = tags.length === 0;
  };
  const addTag = () => {
    const tag = input.value.trim().replace(/\s+/gu, " ");
    if (!tag) return;
    if (tags.includes(tag)) { status.textContent = "That tag is already listed."; return; }
    if (tags.length >= 12) { status.textContent = "You can contribute up to 12 tags."; return; }
    tags.push(tag);
    input.value = "";
    status.textContent = "";
    renderTags();
  };
  add.addEventListener("click", addTag, { signal });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addTag();
  }, { signal });
  assistant.addEventListener("click", async () => {
    if (signal.aborted || typeof openVisibleAssistantPrompt !== "function") return;
    assistant.disabled = true;
    status.textContent = "Opening the visible tag helper…";
    try {
      const result = await openVisibleAssistantPrompt("remibooru-tags");
      status.textContent = result?.ok ? "Copy any suggested tags here when ready." : result?.error || "The tag helper is unavailable.";
    } catch { status.textContent = "The tag helper is unavailable."; }
    finally { if (!signal.aborted) assistant.disabled = false; }
  }, { signal });
  contribute.addEventListener("click", async () => {
    if (signal.aborted || typeof submitMediaContribution !== "function") return;
    contribute.disabled = true;
    status.textContent = "Publishing to public Remibooru…";
    try {
      const result = await submitMediaContribution({ id: "remibooru-contribute", mediaHandle, tags: [...tags] });
      if (!result?.ok) { status.textContent = result?.error || "The contribution could not be completed."; return; }
      status.replaceChildren("Contribution published.");
      if (result.canonicalUrl) status.append(" ", el("a", { className: "tweet-composer-kit__contribution-link", href: result.canonicalUrl, target: "_blank", rel: "noopener noreferrer", textContent: "View on Remibooru" }));
    } catch { status.textContent = "The contribution could not be completed."; }
    finally { if (!signal.aborted) contribute.disabled = tags.length === 0; }
  }, { signal });
  root.append(title, details, el("div", { className: "tweet-composer-kit__contribution-entry" }, input, add), tagList, el("div", { className: "tweet-composer-kit__contribution-actions" }, assistant, contribute, nativeFallback), status);
  renderTags();
  panel.replaceChildren(root);
  signal.addEventListener("abort", () => panel.replaceChildren(), { once: true });
}

function buildMediaPicker({ queryRemoteService, suggestRemoteQueryFacets, attachRemoteQueryResult, signal }) {
  const root = el("section", { className: "tweet-composer-kit__media-picker", ariaLabel: "Remibooru reaction media" });
  const facets = el("input", { className: "tweet-composer-kit__media-query", type: "search", maxLength: 160, placeholder: "Search Remibooru tags", ariaLabel: "Search Remibooru tags", autocomplete: "off" });
  const search = el("button", { className: "tweet-composer-kit__media-button", type: "button", textContent: "Search" });
  const previous = el("button", { className: "tweet-composer-kit__media-page", type: "button", textContent: "◀", ariaLabel: "Previous Remibooru results", title: "Previous results" });
  const next = el("button", { className: "tweet-composer-kit__media-page", type: "button", textContent: "▶", ariaLabel: "Next Remibooru results", title: "Next results" });
  const tags = el("button", { className: "tweet-composer-kit__media-button", type: "button", textContent: "Tags" });
  const results = el("div", { className: "tweet-composer-kit__media-results", role: "list", ariaLabel: "Remibooru results" });
  const attribution = el("p", { className: "tweet-composer-kit__media-disclosure", textContent: "Remibooru thumbnails · click to attach, double-click to open the source post." });
  const status = el("p", { className: "tweet-composer-kit__media-status", role: "status", ariaLive: "polite" });
  const available = typeof queryRemoteService === "function";
  let nextCursor = null;
  let currentCursor = null;
  const previousCursors = [];

  const setBusy = (busy) => {
    root.toggleAttribute("data-busy", busy);
    root.setAttribute("aria-busy", String(busy));
    search.disabled = busy || !available;
    previous.disabled = busy || !available || previousCursors.length === 0;
    next.disabled = busy || !available || !nextCursor;
    tags.disabled = busy || !available;
  };
  const render = (items, replace) => {
    if (replace) results.replaceChildren();
    const safeItems = Array.isArray(items) ? items.filter(isRemibooruResult) : [];
    for (const item of safeItems) {
      const thumbnail = el("img", { className: "tweet-composer-kit__media-thumb", src: item.thumbnailUrl, alt: "", ariaHidden: "true" });
      const control = el("button", {
        className: "tweet-composer-kit__media-item",
        role: "listitem",
        type: "button",
        ariaLabel: "Attach this Remibooru thumbnail to the composer; double-click to open its source post",
        title: "Click to attach; double-click to open on Remibooru",
      }, thumbnail);
      let clickTimer = null;
      const cancelPendingAttach = () => {
        if (clickTimer === null) return;
        clearTimeout(clickTimer);
        clickTimer = null;
      };
      control.addEventListener("click", () => {
        cancelPendingAttach();
        clickTimer = setTimeout(() => {
          clickTimer = null;
          void attachResult(item.id, control);
        }, 250);
      }, { signal });
      control.addEventListener("dblclick", () => {
        cancelPendingAttach();
        openCanonicalPost(root, item.postUrl);
      }, { signal });
      signal.addEventListener("abort", cancelPendingAttach, { once: true });
      results.append(control);
    }
    if (!results.childElementCount) status.textContent = "No matching Remibooru media was found.";
  };
  const load = async ({ cursor = null, history = "reset", suggested = false } = {}) => {
    if (!available || signal.aborted) return;
    const parsedFacets = parseRemibooruFacets(facets.value);
    setBusy(true);
    status.textContent = suggested ? "Finding matching Remibooru media..." : "Searching Remibooru...";
    try {
      const result = await queryRemoteService("remibooru-reactions", {
        resource: "posts",
        limit: 12,
        facets: parsedFacets,
        ...(cursor ? { cursor } : {}),
      });
      if (!result?.ok || !result.page) throw new Error(result?.error || "Remibooru is unavailable.");
      if (signal.aborted) return;
      render(result.page.items, true);
      if (history === "next") previousCursors.push(currentCursor);
      if (history === "previous") currentCursor = previousCursors.pop() || null;
      if (history === "reset") previousCursors.splice(0);
      if (history !== "previous") currentCursor = cursor;
      nextCursor = typeof result.page.nextCursor === "string" && result.page.nextCursor ? result.page.nextCursor : null;
      if (results.childElementCount) status.textContent = "Remibooru results. Click a thumbnail to attach it; double-click to open its canonical post.";
    } catch {
      if (!signal.aborted) {
        status.textContent = "Remibooru is unavailable. Try again.";
      }
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  };

  search.addEventListener("click", () => void load({ history: "reset" }), { signal });
  tags.addEventListener("click", async () => {
    if (!available || signal.aborted) return;
    setBusy(true);
    status.textContent = "Finding suggested Remibooru tags...";
    try {
      const result = typeof suggestRemoteQueryFacets === "function" ? await suggestRemoteQueryFacets("remibooru-reactions") : null;
      if (signal.aborted) return;
      const suggested = normalizeSuggestedFacets(result?.suggestions);
      facets.value = suggested.join(" ");
      await load({ history: "reset", suggested: true });
    } catch {
      if (!signal.aborted) await load({ history: "reset", suggested: true });
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }, { signal });
  facets.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void load({ history: "reset" });
  }, { signal });
  previous.addEventListener("click", () => void load({ cursor: previousCursors[previousCursors.length - 1] || null, history: "previous" }), { signal });
  next.addEventListener("click", () => void load({ cursor: nextCursor, history: "next" }), { signal });
  const attachResult = async (itemId, control) => {
    if (signal.aborted || typeof attachRemoteQueryResult !== "function") {
      status.textContent = "Attaching Remibooru media is not available in this build.";
      return;
    }
    control.disabled = true;
    status.textContent = "Attaching the selected Remibooru thumbnail…";
    try {
      const result = await attachRemoteQueryResult("remibooru-reactions", itemId);
      status.textContent = result?.ok ? "Thumbnail attached to the composer. It has not been posted." : result?.error || "The thumbnail could not be attached.";
    } catch {
      status.textContent = "The thumbnail could not be attached.";
    } finally {
      if (!signal.aborted) control.disabled = false;
    }
  };
  root.append(el("div", { className: "tweet-composer-kit__media-controls" }, facets, search, previous, next, tags), attribution, results, status);
  setBusy(false);
  if (!available) {
    status.textContent = "Remibooru search is not available in this build.";
  }
  return root;
}

function openCanonicalPost(root, postUrl) {
  const link = el("a", { href: postUrl, target: "_blank", rel: "noopener noreferrer" });
  root.append(link);
  link.click();
  link.remove();
}

function normalizeSuggestedFacets(suggestions) {
  return (Array.isArray(suggestions) ? suggestions : []).map((suggestion) => {
    if (typeof suggestion === "string") return suggestion;
    if (suggestion && typeof suggestion.id === "string") return suggestion.id;
    return "";
  }).map((facet) => facet.trim()).filter(Boolean).slice(0, 5).map((facet) => facet.slice(0, 64));
}

function parseRemibooruFacets(value) {
  return String(value || "").split(/[\s,]+/).map((facet) => facet.trim()).filter(Boolean).slice(0, 5).map((facet) => facet.slice(0, 60));
}

function isRemibooruResult(item) {
  return Boolean(item && typeof item.id === "string" && item.id.length > 0 && typeof item.postUrl === "string" && item.postUrl.startsWith("https://remibooru.com/posts/")
    && typeof item.thumbnailUrl === "string" && item.thumbnailUrl.startsWith("https://remibooru.com/media/thumbs/"));
}

function buildMemeControls(random) {
  const tooltipId = "tweet-composer-kit-meme-help";
  const info = el("button", { className: "tweet-composer-kit__info", type: "button", ariaLabel: "How meme this post works", ariaDescribedBy: tooltipId, textContent: "i" },
    el("span", { id: tooltipId, className: "tweet-composer-kit__tooltip", role: "tooltip", textContent: "Choose a maker. Captioned sends the Top text and Bottom text you enter; random meme permits both fields to be empty and asks for an uncaptioned random output. Clicking CHEESEWORLD sends one composer image and its captions for replacement; milXdy never posts." }),
  );
  return el("div", { className: "tweet-composer-kit__meme-controls" },
    el("label", { className: "tweet-composer-kit__random-label", htmlFor: random.id }, random, el("span", { textContent: "random meme?" })),
    info,
  );
}

function buildMakerRow({ externalHandoffs, launchExternalHandoff, random, topInput, bottomInput, signal }) {
  const root = el("div", { className: "tweet-composer-kit__maker-group" });
  const list = el("div", { className: "tweet-composer-kit__maker-row", ariaLabel: "Maker destinations" });
  const status = el("p", { className: "tweet-composer-kit__maker-status", role: "status", ariaLive: "polite", ariaAtomic: "true" });
  const available = new Set(Array.isArray(externalHandoffs) ? externalHandoffs.map((action) => action && action.id) : []);
  for (const maker of makers) {
    const className = `tweet-composer-kit__maker tweet-composer-kit__maker--${maker.theme}`;
    const image = el("img", { className: "tweet-composer-kit__maker-thumb", src: context.resolveAssetUrl(maker.asset), alt: "", ariaHidden: "true" });
    const action = el("button", { className, type: "button", ariaLabel: maker.label, title: maker.label, disabled: typeof launchExternalHandoff !== "function" || !available.has(maker.handoffId) }, image);
    action.addEventListener("click", async () => {
      if (signal.aborted || action.disabled) return;
      setMakerBusy(list, action, true);
      setMakerStatus(status, "busy", `${maker.label} is preparing an image…`);
      try {
        if (maker.handoffId === "cheeseworld-deepfry") {
          const { ok, error } = await launchExternalHandoff("cheeseworld-deepfry", {
            mode: "captioned",
            captions: { topText: topInput.value, bottomText: bottomInput.value },
          });
          if (!signal.aborted && !ok) {
            const detail = typeof error === "string" && error.trim() ? ` ${error.trim()}` : " Try again.";
            setMakerStatus(status, "error", `${maker.label} could not replace the composer image.${detail}`);
          } else if (!signal.aborted) {
            setMakerStatus(status, "success", `${maker.label} replaced the initiating composer image.`);
          }
        } else {
          await launchExternalHandoff(maker.handoffId, {
            mode: random.checked ? "randomMeme" : "captioned",
            captions: { topText: topInput.value, bottomText: bottomInput.value },
          });
          if (!signal.aborted) setMakerStatus(status, "success", `${maker.label} handoff complete. Check the active composer.`);
        }
      } catch (error) {
        if (!signal.aborted) {
          const detail = maker.handoffId === "cheeseworld-deepfry" && error instanceof Error && error.message.trim()
            ? ` ${error.message.trim()}`
            : " Try again.";
          setMakerStatus(status, "error", `${maker.label} could not open.${detail}`);
        }
      } finally {
        if (!signal.aborted) setMakerBusy(list, action, false);
      }
    }, { signal });
    list.append(action);
  }
  root.append(list, status);
  return root;
}

function setMakerStatus(status, state, message) {
  status.dataset.state = state;
  status.textContent = message;
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
