import { cloneVisibleContent, visibleText } from "./visible-text";
import type { PostReadingSettings } from "./shared/types";

export type ConversionSource = { title: string; text: string; sourceUrl: string; site: string; extractor: string; author: string; partial: boolean };
export type ExportReply = { ok?: boolean; audioBase64?: string; audioContentType?: string; error?: string };
export type ExportMessenger = (message: unknown) => Promise<ExportReply | null>;
const CHROME = 'nav, header, footer, aside, script, style, button, form, textarea, [role="navigation"], [aria-hidden="true"], [hidden], .subscription-widget, .subscribe-widget, .paywall, .comments, .post-footer, .recommendations';

export function isTruncatedXPost(post: HTMLElement): boolean {
  return Array.from(post.querySelectorAll('[data-testid="tweet-text-show-more-link"]')).some((control) => !control.closest('[data-testid="quoteTweet"]') && control.closest('article[data-testid="tweet"]') === post);
}

/** Shared extraction for the page action and the post's Share menu audio action. */
export function extractPostConversionSource(post: HTMLElement, url: string): ConversionSource | null {
  if (post.getAttribute('data-testid') === 'twitterArticleReadView') {
    const title = visibleText(post.querySelector<HTMLElement>('[data-testid="twitter-article-title"]'));
    const richText = post.querySelector<HTMLElement>('[data-testid="twitterArticleRichTextView"]');
    if (!richText) return null;
    const body = cloneVisibleContent(richText);
    for (const chrome of Array.from(body.querySelectorAll(CHROME))) chrome.remove();
    const leaves = Array.from(body.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,li,figcaption,[data-testid="tweetText"]')).filter((node) => !node.parentElement?.closest('p,li,figcaption,[data-testid="tweetText"]'));
    const readable = leaves.length ? leaves.map((node) => node.textContent || '').join('\n\n') : body.textContent || '';
    const text = [title,readable].filter(Boolean).join('\n\n').trim();
    return text ? { title: title || "X article", text, sourceUrl:url, site:"X article", extractor:"x:twitterArticleReadView", author:"", partial:false } : null;
  }
  const own = (node: Element) => node.closest('article[data-testid="tweet"]') === post && !node.closest('[data-testid="quoteTweet"]');
  const text = Array.from(post.querySelectorAll<HTMLElement>('[data-testid="tweetText"]')).filter(own).map(visibleText).filter(Boolean).join('\n\n');
  if (!text) return null;
  const author = Array.from(post.querySelectorAll<HTMLElement>('[data-testid="User-Name"]')).filter(own).map(visibleText).find(Boolean) || '';
  const sourceLink = Array.from(post.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')).find(own)?.getAttribute('href');
  const sourceUrl = sourceLink ? new URL(sourceLink, url).href : url;
  return { title:author || "X post", text, sourceUrl, site:"X", extractor:"x:tweetText", author, partial:isTruncatedXPost(post) };
}

export function extractConversionSource(doc: Document, url: string): ConversionSource | null {
  const location = new URL(url);
  const xSite = /^(?:x|twitter)\.com$/i.test(location.hostname);
  if (xSite && /^\/(?:messages|i\/chat)(?:\/|$)/.test(location.pathname)) return null;
  const article = doc.querySelector<HTMLElement>('[data-testid="twitterArticleReadView"]');
  let host: HTMLElement | null = null;
  let extractor = "generic:article-main";
  let partial = false;
  if (article) return extractPostConversionSource(article, url);
  if (xSite) {
    const post = doc.querySelector<HTMLElement>('article[data-testid="tweet"]');
    return post && /^\/[^/]+\/status\/\d+/.test(location.pathname) ? extractPostConversionSource(post, url) : null;
  }
  if (location.hostname === "remilia.wiki" || location.hostname === "wiki.remilia.org") {
    host = doc.querySelector('.mw-parser-output'); extractor = "wiki:mw-parser-output";
  } else if (location.hostname.endsWith('.substack.com') || doc.querySelector('meta[property="og:site_name"][content="Substack"]')) {
    host = doc.querySelector('.body.markup, .available-content .body, .post-content'); extractor = "substack:visible-post-body";
    partial = !!doc.querySelector('.paywall, .paywall-title, [data-testid="paywall"]');
  } else if (location.hostname === 'medium.com' || location.hostname.endsWith('.medium.com')) {
    host = doc.querySelector('article'); extractor = "medium:article";
  }
  if (!host) { host = doc.querySelector('article, [itemprop="articleBody"], main, [role="main"]'); extractor = "generic:article-main"; }
  if (!host) return null;
  const copy = cloneVisibleContent(host);
  for (const node of Array.from(copy.querySelectorAll(CHROME))) node.remove();
  const blocks = Array.from(copy.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6, p, li, blockquote, figcaption, pre'))
    .filter((node) => !node.parentElement?.closest('p, li, blockquote, figcaption, pre'));
  const text = (blocks.length ? blocks.map((node) => node.innerText || node.textContent || '').join('\n\n') : copy.innerText || copy.textContent || '').trim();
  if (!text) return null;
  const title = Array.from(doc.querySelectorAll<HTMLElement>('h1')).map(visibleText).find(Boolean) || doc.title;
  const author = doc.querySelector('meta[name="author"]')?.getAttribute('content') || doc.querySelector('[rel="author"], .byline')?.textContent?.trim() || '';
  return { title, text, sourceUrl: canonicalUrl(doc, url), site: location.hostname, extractor, author, partial };
}

function canonicalUrl(doc: Document, fallback: string): string {
  try { const candidate = new URL(doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || fallback, fallback); return /^https?:$/.test(candidate.protocol) ? candidate.href : fallback; } catch { return fallback; }
}

export function audioFormat(contentType: string): string | null {
  const mime = contentType.split(';')[0]?.trim().toLowerCase();
  return ({ 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm' } as Record<string, string>)[mime || ''] || null;
}
export function audioFilename(title: string, format: string): string {
  return `${title.replace(/[<>:"/|?*\x00-\x1f\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'post-reading'}.${format}`;
}

export function openAudioConversion(source: ConversionSource, settings: PostReadingSettings, sendMessage: ExportMessenger): () => void {
  document.dispatchEvent(new Event('post-reading:close-conversion'));
  document.getElementById('milxdy-audio-conversion')?.remove();
  const panel = document.createElement('dialog');
  panel.id = 'milxdy-audio-conversion';
  panel.setAttribute('aria-label', 'Review and download audio');
  panel.style.cssText = 'box-sizing:border-box;width:min(720px,90vw);max-height:90vh;overflow:auto;padding:24px;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:8px;font:14px/1.5 system-ui,sans-serif;z-index:2147483647';
  const heading = document.createElement('h2'); heading.textContent = 'Review and download audio';
  const title = document.createElement('input'); title.value = source.title; title.setAttribute('aria-label','Audio title'); title.style.cssText = 'box-sizing:border-box;width:100%;font:inherit';
  const author = document.createElement('input'); author.value = source.author; author.setAttribute('aria-label','Author'); author.placeholder = 'Author';
  const text = document.createElement('textarea'); text.value = source.text; text.setAttribute('aria-label','Readable text to convert'); text.style.cssText = 'box-sizing:border-box;width:100%;min-height:40vh;display:block;margin:12px 0;font:inherit';
  const status = document.createElement('p'); status.setAttribute('role','status');
  status.textContent = source.partial ? 'Partial visible content: this page is locked or truncated. Review before converting; no hidden content is fetched.' : `Extracted with ${source.extractor}. Review the text before sending it to your selected TTS service.`;
  const generate = document.createElement('button'); generate.type = 'button'; generate.textContent = 'Download as MP3';
  const preview = document.createElement('button'); preview.type = 'button'; preview.textContent = 'Preview read aloud';
  const results = document.createElement('div');
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
  let requestId: string | null = null;
  let closed = false;
  let audioUrl: string | null = null;
  const metadataUrls: string[] = [];
  const stop = () => { if (requestId) void sendMessage({ type:'post-reading:cancelAudioExport', requestId }); requestId = null; if (settings.ttsEngine === 'web-speech') window.speechSynthesis?.cancel(); };
  const close = () => { closed = true; stop(); if (audioUrl) URL.revokeObjectURL(audioUrl); panel.remove(); for (const url of metadataUrls) URL.revokeObjectURL(url); window.removeEventListener('pagehide', close); document.removeEventListener('post-reading:close-conversion', close); };
  preview.onclick = () => {
    if (settings.ttsEngine !== 'web-speech') { status.textContent = 'Generate audio through the selected custom TTS path to preview its returned audio.'; return; }
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text.value); speech.rate = settings.speed; speech.volume = settings.volume;
    speech.voice = window.speechSynthesis.getVoices().find((voice) => voice.voiceURI === settings.voiceURI) || null;
    window.speechSynthesis.speak(speech);
  };
  generate.onclick = async () => {
    if (requestId) return;
    if (settings.ttsEngine !== 'custom-http' || !settings.customTtsEndpoint) { status.textContent = 'Browser speech cannot export an audio file. Select and configure a custom HTTP TTS backend that returns MP3 or another supported audio format in Post-reading settings.'; return; }
    if (!text.value.trim()) { status.textContent = 'Enter readable text before converting.'; return; }
    const reviewed = { title: title.value, author: author.value, text: text.value };
    requestId = crypto.randomUUID(); const current = requestId;
    generate.disabled = true; text.disabled = true; title.disabled = true; author.disabled = true;
    status.textContent = 'Converting reviewed text through your selected TTS service… Cancel stops generation.';
    try {
      const response = await sendMessage({ type:'post-reading:generateAudioExport', requestId: current, endpoint:settings.customTtsEndpoint, text: reviewed.text, rate: settings.speed, volume: settings.volume, voiceURI: settings.voiceURI });
      if (closed || requestId !== current) return;
      if (!response?.ok || !response.audioBase64) throw new Error(response?.error || 'The TTS service did not return audio.');
      const mime = response.audioContentType || 'audio/mpeg'; const format = audioFormat(mime);
      if (!format) throw new Error(`Unsupported returned audio format: ${mime}. Configure the backend to return MP3, M4A, WAV, Ogg, or WebM.`);
      const bytes = Uint8Array.from(atob(response.audioBase64), (char) => char.charCodeAt(0));
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(new Blob([bytes], {type:mime}));
      const download = document.createElement('a'); download.href = audioUrl; download.download = audioFilename(reviewed.title, format); download.textContent = `Download ${format.toUpperCase()} audio`;
      const audio = document.createElement('audio'); audio.controls = true; audio.src = audioUrl;
      const metadata = { title: reviewed.title, author: reviewed.author, sourceUrl:source.sourceUrl, site:source.site, extractor:source.extractor, partial:source.partial, capturedAt:new Date().toISOString(), estimatedDurationSeconds: Math.ceil(reviewed.text.trim().split(/\s+/).length / (150 * settings.speed) * 60), tts: {engine:settings.ttsEngine, voiceURI:settings.voiceURI, speed:settings.speed, volume:settings.volume}, format };
      const metadataUrl = URL.createObjectURL(new Blob([JSON.stringify(metadata,null,2)],{type:'application/json'}));
      metadataUrls.push(metadataUrl);
      const sidecar = document.createElement('a'); sidecar.href = metadataUrl; sidecar.download = audioFilename(reviewed.title, 'metadata.json'); sidecar.textContent = 'Download source metadata';
      results.replaceChildren(audio,download,document.createTextNode(' · '),sidecar);
      panel.addEventListener('close', () => URL.revokeObjectURL(metadataUrl), {once:true});
      status.textContent = format === 'mp3' ? 'MP3 ready. Download audio and the source metadata sidecar.' : `The selected backend returned ${format.toUpperCase()} rather than MP3. Download this supported format or configure MP3 output at the backend.`;
      if (format === 'mp3') download.click();
    } catch (error) { if (!closed) status.textContent = error instanceof Error ? error.message : String(error); }
    finally { if (!closed) { requestId = null; generate.disabled = false; text.disabled = false; title.disabled = false; author.disabled = false; } }
  };
  cancel.onclick = close; panel.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  window.addEventListener('pagehide',close);
  document.addEventListener('post-reading:close-conversion',close);
  panel.append(heading,title,author,text,status,preview,generate,cancel,results); document.documentElement.append(panel); panel.showModal();
  return close;
}
