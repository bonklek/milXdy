export const TWEET = 'article[data-testid="tweet"]';
export const TWEET_TEXT = '[data-testid="tweetText"]';
export const X_ARTICLE_BODY = [
  '[data-testid*="article" i] [dir="auto"]',
  '[data-testid*="Article" i] [dir="auto"]',
  '[data-testid*="article" i] p',
  '[data-testid*="Article" i] p',
  '[role="article"] [dir="auto"]',
  'main [dir="auto"]',
].join(", ");
export const QUOTE_TWEET = '[data-testid="quoteTweet"]';
export const USER_NAME = '[data-testid="User-Name"]';
export const TWEET_PHOTO = '[data-testid="tweetPhoto"]';
export const CARD_WRAPPER = '[data-testid="card.wrapper"]';
export const STATUS_LINK = 'a[href*="/status/"]';
export const ACTION_BUTTONS = [
  '[data-testid="reply"]',
  '[data-testid="retweet"]',
  '[data-testid="like"]',
  '[data-testid="unlike"]',
  '[data-testid="share"]',
  '[aria-label*="Grok"]',
].join(", ");

export const POST_READING_BUTTON = '[data-post-reading-button="true"]';
