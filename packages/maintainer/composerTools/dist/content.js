// src/apps/composer-tools/content.ts
var TWEET_COMPOSER_SELECTOR = [
  '[data-testid="tweetTextarea_0"]',
  '[data-testid^="tweetTextarea_"]',
  '[role="textbox"][aria-label*="Post" i]',
  '[role="textbox"][aria-label*="Tweet" i]'
].join(",");
var EDITABLE_TEXTBOX_SELECTOR = '[contenteditable="true"], [role="textbox"]';
var NON_TWEET_COMPOSER_SELECTOR = [
  '[data-testid="dm-composer-textarea"]',
  '[data-testid="dm-composer-input"]',
  '[data-testid="dm-composer-editor"]',
  '[data-testid="SearchBox_Search_Input"]',
  "input",
  "textarea"
].join(",");
var EM_DASH = "\u2014";
var booted = false;
var applyingReplacement = false;
function boot(context) {
  if (booted) return;
  booted = true;
  document.documentElement.dataset.milxdyComposerTools = "loaded";
  const beforeInputListener = (event) => {
    if (applyingReplacement || event.defaultPrevented) return;
    if (event.inputType !== "insertText" || event.data !== "-") return;
    const composer = findTweetComposer(event.target);
    if (!composer) return;
    replaceDoubleDashBeforeInsert(event, composer);
  };
  const inputListener = (event) => {
    if (!(event instanceof InputEvent)) return;
    if (applyingReplacement || event.inputType !== "insertText" || event.data !== "-") return;
    const composer = findTweetComposer(event.target);
    if (!composer) return;
    replaceInsertedDoubleDash(composer);
  };
  document.addEventListener("beforeinput", beforeInputListener, true);
  document.addEventListener("input", inputListener, true);
  context.addDisposable(() => document.removeEventListener("beforeinput", beforeInputListener, true));
  context.addDisposable(() => document.removeEventListener("input", inputListener, true));
}
function dispose() {
  delete document.documentElement.dataset.milxdyComposerTools;
  booted = false;
}
function findTweetComposer(target) {
  if (!(target instanceof Element)) return null;
  if (target.closest(NON_TWEET_COMPOSER_SELECTOR)) return null;
  const marker = target.closest(TWEET_COMPOSER_SELECTOR);
  if (!marker) return null;
  const composer = editableComposerForTarget(target, marker);
  if (!composer) return null;
  if (composer.closest('[data-testid="dm-composer-form"], [data-testid="dm-container"]')) return null;
  return composer;
}
function editableComposerForTarget(target, marker) {
  if (isEditableTextBox(marker)) return marker;
  const markerEditable = marker.querySelector(EDITABLE_TEXTBOX_SELECTOR);
  if (markerEditable && isEditableTextBox(markerEditable)) return markerEditable;
  const targetEditable = target.closest(EDITABLE_TEXTBOX_SELECTOR);
  if (targetEditable && isEditableTextBox(targetEditable) && targetEditable.contains(marker)) return targetEditable;
  return null;
}
function isEditableTextBox(element) {
  return element.isContentEditable || element.getAttribute("contenteditable") === "true" || element.getAttribute("role") === "textbox";
}
function replaceDoubleDashBeforeInsert(event, composer) {
  const selection = composer.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;
  const caret = selection.getRangeAt(0);
  if (!composer.contains(caret.startContainer)) return false;
  const precedingRange = rangeForPreviousCharacter(composer, caret, "-");
  if (!precedingRange || precedingRange.toString() !== "-") return false;
  event.preventDefault();
  selection.removeAllRanges();
  selection.addRange(precedingRange);
  return insertText(composer, EM_DASH);
}
function replaceInsertedDoubleDash(composer) {
  const selection = composer.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;
  const caret = selection.getRangeAt(0);
  if (!composer.contains(caret.startContainer)) return false;
  const doubleDashRange = rangeForPreviousText(composer, caret, "--");
  if (!doubleDashRange || doubleDashRange.toString() !== "--") return false;
  selection.removeAllRanges();
  selection.addRange(doubleDashRange);
  return insertText(composer, EM_DASH);
}
function rangeForPreviousCharacter(root, caret, character) {
  const directRange = rangeForDirectPreviousCharacter(caret, character);
  if (directRange) return directRange;
  let previousTextNode = null;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node;
    if (textNode.data.length === 0) continue;
    if (!isTextNodeFullyBeforeCaret(textNode, caret)) break;
    previousTextNode = textNode;
  }
  return previousTextNode ? rangeForTextNodeCharacter(previousTextNode, previousTextNode.data.length - 1, character) : null;
}
function rangeForDirectPreviousCharacter(caret, character) {
  if (!(caret.startContainer instanceof Text) || caret.startOffset <= 0) return null;
  return rangeForTextNodeCharacter(caret.startContainer, caret.startOffset - 1, character);
}
function rangeForTextNodeCharacter(textNode, offset, character) {
  if (textNode.data[offset] !== character) return null;
  const range = textNode.ownerDocument.createRange();
  range.setStart(textNode, offset);
  range.setEnd(textNode, offset + 1);
  return range;
}
function isTextNodeFullyBeforeCaret(textNode, caret) {
  const nodeEnd = textNode.ownerDocument.createRange();
  nodeEnd.setStart(textNode, textNode.data.length);
  nodeEnd.collapse(true);
  return caret.compareBoundaryPoints(Range.START_TO_START, nodeEnd) >= 0;
}
function rangeForPreviousText(root, caret, text) {
  const before = root.ownerDocument.createRange();
  before.selectNodeContents(root);
  before.setEnd(caret.startContainer, caret.startOffset);
  const textBeforeCaret = before.toString();
  if (!textBeforeCaret.endsWith(text)) return null;
  return rangeForTextOffsets(root, textBeforeCaret.length - text.length, textBeforeCaret.length);
}
function rangeForTextOffsets(root, startOffset, endOffset) {
  const start = textPositionForOffset(root, startOffset);
  const end = textPositionForOffset(root, endOffset);
  if (!start || !end) return null;
  const range = root.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}
function textPositionForOffset(root, targetOffset) {
  let traversed = 0;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node;
    const nextTraversed = traversed + textNode.data.length;
    if (targetOffset <= nextTraversed) {
      return { node: textNode, offset: Math.max(0, targetOffset - traversed) };
    }
    traversed = nextTraversed;
  }
  return null;
}
function insertText(root, text) {
  applyingReplacement = true;
  try {
    if (document.queryCommandSupported?.("insertText") && document.execCommand("insertText", false, text)) {
      return true;
    }
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    root.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    return true;
  } finally {
    applyingReplacement = false;
  }
}
export {
  boot,
  dispose
};
