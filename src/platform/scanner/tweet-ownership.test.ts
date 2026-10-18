import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { badgeMatchesTweetAuthor, ownedTweetHeader, quotedTweetHandle, quotedTweetRoot, tweetBadgeAnchor, tweetOwnsNode } from "./tweet-ownership";

function fixture(quoteTestId = false, outerTime = false, nestedName = false, detailMetadata = false) {
  const link = '<a id="author-link" href="/quoter"><span dir="ltr" id="author-name">Quoter</span></a>';
  const name = nestedName ? `<div id="author-cluster"><div>${link}</div></div>` : link;
  const $ = load(`<article data-testid="tweet" id="post">
    <div data-testid="User-Name" id="author-header">${name}${detailMetadata ? '<div id="detail-metadata" data-milxdy-metadata-row><span>@quoter</span></div>' : '<span dir="ltr">@quoter</span>'}${outerTime ? '<a id="author-status" href="/quoter/status/1"><time id="author-time">1h</time></a>' : ''}</div>
    <div data-testid="tweetText">Main post</div>
    <div id="quote" role="link" tabindex="0" ${quoteTestId ? 'data-testid="quoteTweet"' : ''}>
      <div data-testid="User-Name" id="quote-header"><span dir="ltr">Quoted author</span><span dir="ltr">@quoted_author</span><time id="quote-time">2h</time><span id="quote-badge" data-reminet-badge="true"></span></div>
      <div data-testid="tweetText">Quoted post</div>
    </div><span id="author-badge" data-reminet-badge="true"></span>
  </article>`);
  const wrappers = new Map<any, any>();
  const wrap = (node: any): any => {
    if (!node) return null;
    if (wrappers.has(node)) return wrappers.get(node);
    const value = {
      get id() { return $(node).attr('id'); },
      get tagName() { return String(node.name ?? "").toUpperCase(); },
      get children() { return $(node).children().toArray().map(wrap); },
      get textContent() { return $(node).text(); },
      get parentElement() { return wrap(node.parent?.type === 'tag' ? node.parent : null); },
      matches: (selector: string) => $(node).is(selector),
      closest: (selector: string) => wrap($(node).closest(selector)[0]),
      querySelector: (selector: string) => wrap($(node).find(selector)[0]),
      querySelectorAll: (selector: string) => $(node).find(selector).toArray().map(wrap),
      contains: (other: any) => other === value || $(node).find('*').toArray().some(child => wrap(child) === other),
    };
    wrappers.set(node, value);
    return value;
  };
  return (id: string) => wrap($(`#${id}`)[0]) as HTMLElement;
}

describe('quote-aware stats badge ownership', () => {
  it.each([false, true])('keeps the quoter outside the quote, including markerless X cards: %s', testid => {
    const node = fixture(testid);
    expect(tweetBadgeAnchor(node('post'))?.id).toBe('author-link');
    expect(ownedTweetHeader(node('post'))?.id).toBe('author-header');
    expect(tweetOwnsNode(node('post'), node('quote-time'))).toBe(false);
    expect(quotedTweetRoot(node('quote-header'))).toBe(node('quote'));
  });
  it('places expanded-post stats outside the nested display-name row', () => {
    const node = fixture(false, false, true);
    expect(tweetBadgeAnchor(node('post'))?.id).toBe('author-cluster');
    expect(tweetBadgeAnchor(node('post'))?.parentElement).toBe(node('author-header'));
  });
  it('anchors detail metrics after owned metadata instead of a quoted author', () => {
    const node = fixture(true, false, true, true);
    expect(tweetBadgeAnchor(node('post'))?.id).toBe('detail-metadata');
    expect(tweetBadgeAnchor(node('post'))?.parentElement).toBe(node('author-header'));
    expect(tweetBadgeAnchor(node('quote'))?.id).toBe('quote-time');
  });
  it('uses each author’s own timestamp when both headers have one', () => {
    const node = fixture(false, true);
    expect(tweetBadgeAnchor(node('post'))?.id).toBe('author-status');
    expect(tweetBadgeAnchor(node('quote'))?.id).toBe('quote-time');
  });
  it('keeps both badges and quoted lookup identities independent', () => {
    const node = fixture();
    expect(tweetOwnsNode(node('post'), node('author-badge'))).toBe(true);
    expect(tweetOwnsNode(node('post'), node('quote-badge'))).toBe(false);
    expect(tweetOwnsNode(node('quote'), node('quote-badge'))).toBe(true);
    expect(tweetOwnsNode(node('quote'), node('author-badge'))).toBe(false);
    expect(quotedTweetHandle(node('quote'))).toBe('quoted_author');
  });
  it('uses the same metadata host when a like rerender replaces the timestamp wrapper', () => {
    for (const wrapped of [false, true]) {
      const $ = load(`<article data-testid="tweet"><div data-testid="User-Name"><div><a href="/author">Author</a></div><div id="metadata"><div id="native-meta"><a href="/author">@author</a>${wrapped ? '<div><div>' : ''}<a href="/author/status/1"><time>1h</time></a>${wrapped ? '</div></div>' : ''}</div></div></div></article>`);
      const wrappers = new Map<any, any>();
      const wrap = (node: any): any => {
        if (!node) return null;
        if (wrappers.has(node)) return wrappers.get(node);
        const result = {
          get id() { return $(node).attr('id'); },
          get tagName() { return String(node.name ?? '').toUpperCase(); },
          get children() { return $(node).children().toArray().map(wrap); },
          get textContent() { return $(node).text(); },
          get parentElement() { return wrap(node.parent?.type === 'tag' ? node.parent : null); },
          matches: (s: string) => $(node).is(s),
          closest: (s: string) => wrap($(node).closest(s)[0]),
          querySelector: (s: string) => wrap($(node).find(s)[0]),
          querySelectorAll: (s: string) => $(node).find(s).toArray().map(wrap),
          contains: (other: any) => other === result || $(node).find('*').toArray().some(child => wrap(child) === other),
        };
        wrappers.set(node, result);
        return result;
      };
      const anchor = tweetBadgeAnchor(wrap($('article')[0]));
      expect(anchor?.id).toBe('native-meta');
      expect(anchor?.parentElement?.id).toBe('metadata');
    }
  });
  it('rejects a badge or delayed lookup from a different or recycled author', () => {
    expect(badgeMatchesTweetAuthor('quoter', 'quoted_author')).toBe(false);
    expect(badgeMatchesTweetAuthor('quoter', '')).toBe(false);
    expect(badgeMatchesTweetAuthor('@Quoter', 'quoter')).toBe(true);
  });
});
