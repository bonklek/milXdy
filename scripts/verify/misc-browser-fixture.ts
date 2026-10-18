import { markTweetHeaderScaffold, tweetHeaderScaffoldPresent } from "../../src/platform/runtime/tweet-header-scaffold";
import { markDisplayNameText } from '../../src/platform/visuals/display-name';
import { installChatJumpControl, syncChatJumpControl } from '../../src/apps/reminet-chat/jump-control';
import { normalizeVisualTheme } from '../../src/platform/visuals/reskin-profile';
import css from '../../src/platform/visuals/reskin.css';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  let namesChecked = 0;
  for (const profile of ['max', 'moderate']) {
    document.documentElement.dataset.milxdyReskinProfile = profile;
    for (const width of [140, 220, 360]) {
      for (const name of ['Long display name with many letters', '👩🏽‍🚀 e\u0301 検証された長い名前', '短い名']) {
        for (const badge of ['', '42', '42 🪲 100']) {
          const article = document.createElement('article');
          article.style.width = `${width}px`;
          article.innerHTML = '<div data-milxdy-tweet-header="true"><div data-milxdy-display-name-cluster="true"><div data-milxdy-display-name-row="true"><a data-milxdy-display-name="true"><div><span></span></div></a><svg style="width:12px;height:12px" aria-label="Verified"></svg></div></div><div data-milxdy-metadata-row="true">@user · 1h</div></div>';
          const link = article.querySelector<HTMLElement>('a')!;
          link.querySelector('span')!.textContent = name;
          markDisplayNameText(link);
          if (badge) {
            const slot = document.createElement('span');
            slot.className = 'reminet-badge-slot';
            slot.textContent = badge;
            link.parentElement!.append(slot);
          }
          document.body.append(article);
          const owner = link.querySelector<HTMLElement>('[data-milxdy-display-name-text]')!;
          check(owner.textContent === name, 'Name text changed');
          check(getComputedStyle(owner).textOverflow === 'ellipsis', 'Missing native ellipsis');
          check(getComputedStyle(owner).overflowX === 'hidden', 'Text owner must constrain overflow');
          check(getComputedStyle(link).overflowX === 'visible', 'Link clips the name');
          check(getComputedStyle(link.parentElement!).overflowX === 'visible', 'Row clips the name');
          check(getComputedStyle(link.parentElement!.parentElement!).overflowX === 'visible', 'Cluster clips the name');
          check(owner.clientWidth <= link.parentElement!.clientWidth + 1, 'Name exceeds its row');
          const slot = article.querySelector<HTMLElement>('.reminet-badge-slot');
          if (slot) check(link.getBoundingClientRect().right <= slot.getBoundingClientRect().left + 1, 'Badge overlaps name');
          namesChecked++;
          article.remove();
        }
      }
    }
  }
  const emojiName = document.createElement('a');
  emojiName.textContent = 'Name';
  markDisplayNameText(emojiName);
  emojiName.innerHTML = '<span>Name<img alt="👩🏽‍🚀"></span>';
  markDisplayNameText(emojiName);
  check(!emojiName.hasAttribute('data-milxdy-display-name-text'), 'Stale outer name marker remains');
  check(emojiName.querySelector('[data-milxdy-display-name-text]') === emojiName.firstElementChild,
    'Inline emoji must stay with its text owner');
  const recycled = document.createElement('article');
  recycled.innerHTML = '<div data-testid="User-Name"><div><div><a href="/user"><span>Original name</span></a></div></div><div><span>@user</span><time>1h</time></div></div>';
  const ownsNode = () => true;
  markTweetHeaderScaffold(recycled, ownsNode);
  check(tweetHeaderScaffoldPresent(recycled, ownsNode), 'Initial header cache invalid');
  const recycledLink = recycled.querySelector('a')!;
  recycledLink.innerHTML = '<div><span>Long replaced display name 👩🏽‍🚀</span></div>';
  check(!tweetHeaderScaffoldPresent(recycled, ownsNode), 'Replaced text incorrectly reuses cached header');
  // This is the same predicate and repair used by runtime signature caching.
  if (!tweetHeaderScaffoldPresent(recycled, ownsNode)) markTweetHeaderScaffold(recycled, ownsNode);
  check(tweetHeaderScaffoldPresent(recycled, ownsNode), 'Replaced header did not repair');
  check(recycledLink.querySelector('[data-milxdy-display-name-text]') === recycledLink.querySelector('span'), 'Replacement text owner missing');
  document.documentElement.dataset.milxdyVisualHideBoostButton = 'true';
  const controls = document.createElement('article');
  controls.innerHTML = '<button data-testid="boostButton">Boost</button><button data-testid="retweet">Repost</button><p><a href="https://ads.x.com/example">Ordinary post link</a></p>';
  document.body.append(controls);
  check(getComputedStyle(controls.querySelector('[data-testid="boostButton"]')!).display === 'none', 'Boost is visible by default');
  check(getComputedStyle(controls.querySelector('[data-testid="retweet"]')!).display !== 'none', 'Repost was hidden');
  check(getComputedStyle(controls.querySelector('p a')!).display !== 'none', 'Ordinary post link was hidden');
  document.documentElement.dataset.milxdyVisualHideBoostButton = 'false';
  check(getComputedStyle(controls.querySelector('[data-testid="boostButton"]')!).display !== 'none', 'Boost does not restore');
  check(normalizeVisualTheme({}, 'min').hideBoostButton === true, 'Old saved theme loses default');
  check(normalizeVisualTheme({ hideBoostButton: false }, 'max').hideBoostButton === false, 'Explicit opt-out lost');

  const chat = document.createElement('section');
  chat.innerHTML = '<div data-role="messages" tabindex="0" style="height:100px;overflow:auto"><div style="height:1000px"></div></div><div data-role="jump-controls" hidden><button data-role="jump-bottom">↓</button><button data-role="dismiss-jump">×</button></div>';
  document.body.append(chat);
  installChatJumpControl(chat);
  const messages = chat.querySelector<HTMLElement>('[data-role="messages"]')!;
  const prompt = chat.querySelector<HTMLElement>('[data-role="jump-controls"]')!;
  syncChatJumpControl(chat, true);
  check(!prompt.hidden, 'Jump prompt absent above bottom');
  chat.querySelector<HTMLButtonElement>('[data-role="dismiss-jump"]')!.click();
  check(prompt.hidden, 'Dismiss did not hide prompt');
  syncChatJumpControl(chat, true);
  check(prompt.hidden, 'Render resurrected dismissed prompt');
  messages.scrollTop = messages.scrollHeight;
  messages.dispatchEvent(new Event('scroll'));
  messages.scrollTop = 0;
  messages.dispatchEvent(new Event('scroll'));
  check(!prompt.hidden, 'Prompt did not rearm after reaching bottom');
  chat.querySelector<HTMLButtonElement>('[data-role="jump-bottom"]')!.click();
  check(messages.scrollTop > 800 && prompt.hidden, 'Jump did not reach bottom');
  messages.scrollTop = 0;
  syncChatJumpControl(chat, false);
  check(prompt.hidden, 'Signed-out chat shows jump prompt');
  const result = document.createElement('pre');
  result.id = 'result';
  const outcome = { passed: true, namesChecked, chatDismissal: true, boostRestore: true };
  (globalThis as any).__miscResult = outcome;
  result.textContent = JSON.stringify(outcome);
  document.body.append(result);
} catch (error) {
  const result = document.createElement('pre');
  result.id = 'result';
  const outcome = { passed: false, error: String(error) };
  (globalThis as any).__miscResult = outcome;
  result.textContent = JSON.stringify(outcome);
  document.body.append(result);
}
