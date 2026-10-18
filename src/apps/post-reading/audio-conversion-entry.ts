import { extractConversionSource, openAudioConversion } from './audio-conversion';
import { DEFAULT_SETTINGS } from './shared/defaults';
import type { MilxdyPageContextActionHost } from '../../platform/app-sdk/app-platform';
import type { PostReadingSettings } from './shared/types';

const host = (globalThis as typeof globalThis & { __MILXDY_PAGE_CONTEXT_ACTION__?: MilxdyPageContextActionHost<PostReadingSettings> }).__MILXDY_PAGE_CONTEXT_ACTION__;
if (host?.appId === 'post-reading') {
  const source = extractConversionSource(document, window.location.href);
  if (source) openAudioConversion(source, { ...DEFAULT_SETTINGS, ...host.storage.sync.values }, (message) => host.sendMessage(message));
  else if (!/^\/(?:messages|i\/chat)(?:\/|$)/.test(window.location.pathname)) openAudioConversion({ title: document.title, text: '', sourceUrl: window.location.href, site: window.location.hostname, extractor: 'manual-paste:extraction-unavailable', author: '', partial: true }, { ...DEFAULT_SETTINGS, ...host.storage.sync.values }, (message) => host.sendMessage(message));
}
