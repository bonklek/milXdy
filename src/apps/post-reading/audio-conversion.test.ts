import { describe, expect, it } from 'vitest';
import { load } from 'cheerio';
import { audioFilename, audioFormat, extractConversionSource, isTruncatedXPost } from './audio-conversion';

function documentFixture(html: string): Document {
  const $ = load(html);
  const cache = new Map<object, unknown>();
  const adapt = (node: any): any => {
    if (!node) return null;
    if (cache.has(node)) return cache.get(node);
    const value = {
    get textContent() { return $(node).text(); },
      set textContent(value: string) { $(node).text(value); },
    get title() { return $('title').text(); },
    get parentElement() { return adapt(node.parent); },
    querySelector: (selector: string) => adapt($(node).find(selector).get(0)),
    querySelectorAll: (selector: string) => $(node).find(selector).toArray().map(adapt),
    getAttribute: (name: string) => $(node).attr(name) ?? null,
    closest: (selector: string) => adapt($(node).closest(selector).get(0)),
    cloneNode: () => adapt($(node).clone().get(0)),
    remove: () => $(node).remove(),
    };
    cache.set(node, value);
    return value;
  };
  return adapt($.root().get(0));
}

describe('reviewed long-form source extraction', () => {
  it('selects known Substack body, author and canonical URL, excluding signup/comments/recommendations', () => {
    const doc = documentFixture('<title>Browser title</title><link rel="canonical" href="https://writer.substack.com/p/post"><meta name="author" content="Writer"><h1>Visible title</h1><div class="body markup"><p>First paragraph with <a href="/ref">a reference</a>.</p><div class="subscribe-widget"><p>Subscribe</p></div><p>Second paragraph.</p><div class="comments"><p>A comment</p></div></div><aside>Recommendations</aside>');
    expect(extractConversionSource(doc, 'https://writer.substack.com/p/post?tracking=1')).toMatchObject({ title:'Visible title', author:'Writer', sourceUrl:'https://writer.substack.com/p/post', text:'First paragraph with a reference.\n\nSecond paragraph.', extractor:'substack:visible-post-body', partial:false });
  });
  it('reports a paywalled Substack preview as partial and never fetches hidden content', () => {
    expect(extractConversionSource(documentFixture('<h1>Locked</h1><div class="body markup"><p>Preview</p><div class="paywall">Subscribe</div></div>'), 'https://writer.substack.com/p/locked')).toMatchObject({text:'Preview', partial:true});
  });
  it.each([
    ['https://wiki.remilia.org/Page', '<div class="mw-parser-output"><p>Wiki body</p></div>', 'wiki:mw-parser-output'],
    ['https://medium.com/@writer/story', '<article><p>Medium body</p></article>', 'medium:article'],
    ['https://blog.example/story', '<main><nav>Navigation</nav><h2>Heading</h2><p>Blog body</p><ul><li>List item</li></ul><footer>Footer</footer></main>', 'generic:article-main'],
  ])('extracts %s before falling back to ordinary article blocks', (url,html,extractor) => {
    const source = extractConversionSource(documentFixture(html),url);
    expect(source?.extractor).toBe(extractor);
    expect(source?.text).not.toMatch(/Navigation|Footer/);
    expect(source?.text.length).toBeGreaterThan(0);
  });
  it('excludes display:none and visibility:hidden descendants before detached extraction', () => {
    const doc = documentFixture('<article><p>Visible</p><div style="display:none"><p>Locked text</p></div><p style="visibility:hidden">Hidden text</p></article>');
    expect(extractConversionSource(doc,'https://blog.example/post')?.text).toBe('Visible');
  });
  it('flags a truncated native post while ignoring a quoted post truncation control', () => {
    const own = documentFixture('<article data-testid="tweet"><div data-testid="tweetText">Visible preview</div><button data-testid="tweet-text-show-more-link">Show more</button></article>');
    expect(isTruncatedXPost(own.querySelector('article') as HTMLElement)).toBe(true);
    expect(extractConversionSource(own,'https://x.com/writer/status/123')?.partial).toBe(true);
    const quoted = documentFixture('<article data-testid="tweet"><div data-testid="tweetText">Full post</div><div data-testid="quoteTweet"><button data-testid="tweet-text-show-more-link">Show more</button></div></article>');
    expect(isTruncatedXPost(quoted.querySelector('article') as HTMLElement)).toBe(false);
  });
  it('rejects private X conversations and unsupported pages', () => {
    expect(extractConversionSource(documentFixture('<main><p>Private message</p></main>'),'https://x.com/messages/123')).toBeNull();
    expect(extractConversionSource(documentFixture('<main><p>Private chat</p></main>'),'https://x.com/i/chat/123')).toBeNull();
    expect(extractConversionSource(documentFixture('<nav>Only navigation</nav>'),'https://example.org/')).toBeNull();
  });
});

describe('audio download formats and filenames', () => {
  it('honors backend formats without pretending WAV is MP3', () => {
    expect(audioFormat('audio/mpeg; charset=binary')).toBe('mp3');
    expect(audioFormat('audio/mp4')).toBe('m4a');
    expect(audioFormat('audio/wav')).toBe('wav');
    expect(audioFormat('text/html')).toBeNull();
  });
  it('creates useful portable source filenames and a metadata sidecar', () => {
    expect(audioFilename('A post: / example?', 'mp3')).toBe('A post example.mp3');
    expect(audioFilename('', 'm4a')).toBe('post-reading.m4a');
    expect(audioFilename('Title', 'metadata.json')).toBe('Title.metadata.json');
  });
});
