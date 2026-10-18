import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import { extractConversationReading, isDirectMessageRoute } from "./direct-messages";

function conversation(html: string, rootId = "DmActivityViewport"): HTMLElement {
  const $ = load(`<div data-testid="${rootId}">${html}</div>`);
  const cache = new Map<object, unknown>();
  const adapt = (node: any): any => {
    if (!node) return null;
    if (cache.has(node)) return cache.get(node);
    const value = {
      getAttribute: (name: string) => $(node).attr(name) ?? null,
      cloneNode: () => adapt($(node).clone().get(0)),
      remove: () => $(node).remove(),
      get parentElement() { return adapt(node.parent); },
      querySelectorAll: (selector: string) => $(node).find(selector).toArray().map(adapt),
      closest: (selector: string) => adapt($(node).closest(selector).get(0)),
      get textContent() { return $(node).text(); },
      set textContent(value: string) { $(node).text(value); },
      get hidden() { return $(node).attr('hidden') !== undefined; },
    };
    cache.set(node, value);
    return value;
  };
  return adapt($(`[data-testid="${rootId}"]`).get(0));
}
const entry = (id: string, text: string, direction = 'incoming') => `<div data-testid="messageEntry" data-message-id="${id}" data-message-direction="${direction}"><span>12:00</span><div data-testid="messageText">${text}</div><button>React</button></div>`;

describe('private conversation snapshots', () => {
  it('accepts conversation and modern chat landing routes while rejecting legacy inbox and lookalikes', () => {
    for (const route of ['/messages/123-456', '/i/chat', '/i/chat/', '/i/chat/123', '/i/chat/g123']) expect(isDirectMessageRoute(route)).toBe(true);
    for (const route of ['/messages', '/messages/', '/home', '/messages/123/detail', '/i/chatty', '/i/chat/123/detail']) expect(isDirectMessageRoute(route)).toBe(false);
  });
  it('preserves displayed message order, speaker boundaries, and highlighting offsets without chrome', () => {
    const snapshot = extractConversationReading(conversation(`<header>Inbox</header>${entry('1', 'Hello')}${entry('2', 'Hello', 'outgoing')}<textarea>Draft</textarea>`));
    expect(snapshot.text).toBe('Other person: Hello\n\nYou: Hello');
    expect(snapshot.bodies.map((body) => snapshot.text.slice(body.start, body.end))).toEqual(['Hello', 'Hello']);
  });
  it('deduplicates virtualized copies by message identity but preserves different messages with equal text', () => {
    const snapshot = extractConversationReading(conversation(entry('1', 'Same') + entry('1', 'Same') + entry('2', 'Same')));
    expect(snapshot.bodies).toHaveLength(2);
  });
  it('supports explicit conversation panels while excluding nested conversations and generic private text', () => {
    const snapshot = extractConversationReading(conversation(entry('1', 'Panel message') + `<div data-testid="DmActivityViewport">${entry('2', 'Other conversation')}</div><p>Generic private page text</p><textarea>Draft</textarea>`, 'dm-conversation-panel'));
    expect(snapshot.text).toBe('Other person: Panel message');
  });
  it('reads modern message body wrappers without inferring speaker identity from private labels', () => {
    const modern = '<div data-testid="message-synthetic"><div role="article"><div data-testid="message-text-synthetic">Modern message</div></div><button>React</button></div>';
    expect(extractConversationReading(conversation(modern + modern, 'dm-conversation-panel')).text).toBe('Message: Modern message');
  });
  it('preserves distinct legacy messages without an identity attribute', () => {
    const withoutId = '<div data-testid="messageEntry"><div data-testid="messageText">Same</div></div>';
    expect(extractConversationReading(conversation(withoutId + withoutId)).bodies).toHaveLength(2);
  });
  it('omits hidden text and keeps an immutable snapshot when newly loaded messages are captured later', () => {
    const first = extractConversationReading(conversation(entry('1', 'Visible') + `<div hidden>${entry('2', 'Hidden')}</div>`));
    const next = extractConversationReading(conversation(entry('1', 'Visible') + entry('3', 'New')));
    expect(first.text).toBe('Other person: Visible');
    expect(next.bodies).toHaveLength(2);
  });
});
