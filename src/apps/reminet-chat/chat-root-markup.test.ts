import { load } from 'cheerio';
import { describe, expect, it } from 'vitest';
import { chatRootMarkup, CHAT_MEDIA_UNAVAILABLE } from './chat-root-markup';

describe('chat close and media availability controls', () => {
  it('exposes an explicitly labeled close button next to header controls', () => {
    const $ = load(chatRootMarkup(''));
    expect($('.milxdy-chat-header-actions [data-role="close"]').attr('aria-label')).toBe('Close chat');
    expect($('.milxdy-chat-header-actions [data-role="close"]').text()).toBe('×');
    expect($('[data-role="close"]').attr('type')).toBe('button');
  });
  it('does not present unavailable official media uploads as a working attachment action', () => {
    const $ = load(chatRootMarkup(''));
    expect($('[data-role="attach"]').attr('disabled')).toBeDefined();
    expect($('[data-role="attach"]').attr('data-chat-action')).toBeUndefined();
    expect($('[data-role="attach"]').attr('title')).toContain('Official Chat supports text');
    expect(CHAT_MEDIA_UNAVAILABLE).toContain('your text draft stays here');
  });
  it('offers an explicit native website fallback without adding unsupported scopes', () => {
    const $ = load(chatRootMarkup(''));
    const link = $('.milxdy-chat-media-availability a');
    expect(link.attr('href')).toBe('https://www.remilia.net/');
    expect(link.attr('target')).toBe('_blank');
    expect(link.attr('rel')).toBe('noopener noreferrer');
    expect(link.attr('data-chat-action')).toBeUndefined();
  });
});
