import { extractConversionSource, extractPostConversionSource } from '../../src/apps/post-reading/audio-conversion';
import { extractConversationReading } from '../../src/apps/post-reading/direct-messages';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  const style = document.createElement('style');
  style.textContent = '.css-hidden {display:none} .css-invisible {visibility:hidden}';
  document.head.append(style);
  let checks = 0;
  const reset = (html: string) => { document.body.innerHTML = html; };
  reset('<article><h1>Visible title</h1><p>Visible body</p><div class="css-hidden"><p>Locked CSS text</p></div><p class="css-invisible">Invisible CSS text</p></article>');
  check(getComputedStyle(document.querySelector('.css-hidden')!).display === 'none', 'Fixture did not establish stylesheet hiding');
  check(extractConversionSource(document, 'https://blog.example/post')?.text === 'Visible title\n\nVisible body', 'Generic extraction included CSS-hidden descendants'); checks++;
  reset('<div class="css-hidden"><article><p>Ancestor-hidden article</p></article></div>');
  check(extractConversionSource(document, 'https://blog.example/post') === null, 'Generic extraction ignored hidden ancestor'); checks++;
  reset('<article data-testid="tweet"><div data-testid="User-Name">Visible author<span class="css-hidden">Hidden author</span></div><div data-testid="tweetText">Visible post<span class="css-hidden">Hidden inline post</span></div><div class="css-hidden" data-testid="tweetText">Hidden post</div><div data-testid="quoteTweet"><div data-testid="User-Name">Quoted author</div><div data-testid="tweetText">Quoted body</div></div></article>');
  const post = document.querySelector<HTMLElement>('article')!;
  for (const source of [extractConversionSource(document,'https://x.com/writer/status/123'), extractPostConversionSource(post,'https://x.com/writer/status/123')]) {
    check(source?.text === 'Visible post', 'X page/direct action exported hidden or quoted post text');
    check(source?.author === 'Visible author', 'X page/direct action used hidden or quoted author'); checks++;
  }
  post.classList.add('css-hidden');
  check(extractPostConversionSource(post,'https://x.com/writer/status/123') === null, 'Direct action exported hidden post root'); checks++;
  reset('<div data-testid="twitterArticleReadView"><div data-testid="twitter-article-title">Visible article title<span class="css-hidden">Hidden title</span></div><div data-testid="twitterArticleRichTextView"><p>Visible article paragraph</p><p class="css-hidden">Locked article paragraph</p></div></div>');
  const article = extractConversionSource(document,'https://x.com/i/article/123');
  check(article?.title === 'Visible article title' && article.text === 'Visible article title\n\nVisible article paragraph', 'Native article included hidden title or body'); checks++;
  reset('<div data-testid="DmActivityViewport"><div data-testid="messageEntry" data-message-id="1" data-message-direction="incoming"><div data-testid="messageText">Visible message<span class="css-hidden">Hidden DM descendant</span></div></div><div class="css-hidden" data-testid="messageEntry" data-message-id="2"><div data-testid="messageText">Hidden DM entry</div></div><div data-testid="messageEntry" data-message-id="3"><div class="css-invisible" data-testid="messageText">Invisible DM text</div></div></div>');
  const conversation = document.querySelector<HTMLElement>('[data-testid="DmActivityViewport"]')!;
  check(extractConversationReading(conversation).text === 'Other person: Visible message', 'DM snapshot included CSS-hidden text'); checks++;
  const ancestor = document.createElement('div'); ancestor.className = 'css-hidden'; conversation.replaceWith(ancestor); ancestor.append(conversation);
  check(extractConversationReading(conversation).text === '', 'DM snapshot ignored hidden ancestor above conversation'); checks++;
  (globalThis as any).__readerVisibleResult = { passed:true, checks, engine:navigator.userAgent };
} catch (error) {
  (globalThis as any).__readerVisibleResult = { passed:false, error:error instanceof Error ? error.message : String(error) };
}
