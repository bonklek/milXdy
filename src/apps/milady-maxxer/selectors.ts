// ---------------------------------------------------------------------------
// Centralized DOM selectors for the Chrome extension.
//
// All querySelector / querySelectorAll strings used in content.ts, effects.ts,
// and sounds.ts live here so they can be updated in one place when Twitter/X
// changes its markup.  CSS selectors in styles.ts are NOT imported from here
// because CSS template strings cannot reference JS constants.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tweet & timeline structure
// ---------------------------------------------------------------------------

/** A single tweet article element. */
export const TWEET = 'article[data-testid="tweet"]';

/** A notification article element. */
export const NOTIFICATION = 'article[data-testid="notification"]';

/** User cells in "Who to follow", follower lists, etc. */
export const USER_CELL = '[data-testid="UserCell"], [data-testid="user-cell"]';

/** The wrapper around each timeline item (tweet, notification, etc.). */
export const CELL_INNER_DIV = '[data-testid="cellInnerDiv"]';

// ---------------------------------------------------------------------------
// Tweet sub-elements
// ---------------------------------------------------------------------------

/** Container that wraps a tweet author's avatar. */
export const TWEET_USER_AVATAR = '[data-testid="Tweet-User-Avatar"]';

/** Link inside the avatar container pointing to the author's profile. */
export const TWEET_USER_AVATAR_LINK = '[data-testid="Tweet-User-Avatar"] a[href^="/"]';

/** The display-name + handle row on a tweet. */
export const USER_NAME = '[data-testid="User-Name"]';

/** Profile images (used broadly to locate avatars). */
export const PROFILE_IMAGE = 'img[src*="profile_images"]';

/** A quote-tweet embed inside a tweet. */
export const QUOTE_TWEET = '[data-testid="quoteTweet"]';

/** A link to a specific status (used to extract tweet URLs). */
export const STATUS_LINK = 'a[href*="/status/"]';

/** "Replying to @handle" link inside a reply tweet. */
export const REPLY_TO_LINK = 'div[id^="id__"] a[href^="/"][role="link"]';

// ---------------------------------------------------------------------------
// Notification sub-elements
// ---------------------------------------------------------------------------

/** Notification avatar containers — the data-testid includes the username. */
export const NOTIFICATION_AVATAR_CONTAINER = '[data-testid^="UserAvatar-Container-"]';

// ---------------------------------------------------------------------------
// Engagement buttons
// ---------------------------------------------------------------------------

/** Like button (not yet liked). */
export const LIKE_BUTTON = '[data-testid="like"]';
/** Fallback: aria-label based like detection. */
export const LIKE_BUTTON_FALLBACK = '[aria-label="Like"], [aria-label="Likes"]';

/** Unlike button (already liked). */
export const UNLIKE_BUTTON = '[data-testid="unlike"]';

/** Like count text container (used inside a like button context). */
export const LIKE_COUNT = 'span[data-testid="app-text-transition-container"]';

/** Unfollow button — indicates the user IS following this account. */
export const UNFOLLOW_BUTTON = '[data-testid$="-unfollow"]';

/** Follow button — indicates the user is NOT following. */
export const FOLLOW_BUTTON = '[data-testid$="-follow"]';

/** "Following" indicator via aria-label. */
export const FOLLOWING_INDICATOR = '[aria-label*="Following"]';

/** "Follows you" badge on tweets / profile. */
export const FOLLOWS_YOU_INDICATOR = '[data-testid="userFollowIndicator"]';

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/** Tweet photo, video player, and card selectors (comma-separated for querySelectorAll). */
export const MEDIA_ELEMENTS = '[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="card.wrapper"]';

// ---------------------------------------------------------------------------
// Interactive elements (for click-sound detection)
// ---------------------------------------------------------------------------

/** Generic interactive element selector used for click sound targeting. */
export const INTERACTIVE_ELEMENT = 'a, button, [role="button"], [data-testid]';

// ---------------------------------------------------------------------------
// Compose / post buttons
// ---------------------------------------------------------------------------

/** Tweet send buttons (regular and inline reply). */
export const POST_BUTTONS = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]';

/** Tweet composer textarea (used to distinguish tweet compose from DM compose). */
export const TWEET_COMPOSER = '[data-testid="tweetTextarea_0"]';

// ---------------------------------------------------------------------------
// DMs & conversations
// ---------------------------------------------------------------------------

/** The top-level DM container. */
export const DM_CONTAINER = '[data-testid="dm-container"]';

/** An open conversation panel. */
export const DM_CONVERSATION_PANEL = '[data-testid="dm-conversation-panel"]';

/** The scrollable message list inside a conversation. */
export const DM_MESSAGE_LIST = '[data-testid="dm-message-list"]';

/** Individual messages (testid is "message-{uuid}"). */
export const DM_MESSAGE = '[data-testid^="message-"]:not([data-testid^="message-text-"])';

/** Message text elements (testid is "message-text-{uuid}"). */
export const DM_MESSAGE_TEXT = '[data-testid^="message-text-"]';

/** The DM composer textarea. */
export const DM_COMPOSER = '[data-testid="dm-composer-textarea"]';

/** The DM composer form (wraps textarea + send button). */
export const DM_COMPOSER_FORM = '[data-testid="dm-composer-form"]';

/** Reaction badges on DM messages (aria-label fallback since no dedicated testid). */
export const DM_REACTIONS = '[aria-label*="reaction"], [aria-label*="Reaction"]';

/** The popup / overlay layers container (for emoji pickers, etc.). */
export const LAYERS = '#layers';

// ---------------------------------------------------------------------------
// Profile page
// ---------------------------------------------------------------------------

/** Primary content column. */
export const PRIMARY_COLUMN = '[data-testid="primaryColumn"]';

/** The username element on a profile page (inside the primary column). */
export const PROFILE_USER_NAME = '[data-testid="primaryColumn"] [data-testid="UserName"]';

/** Profile avatar image on the profile page. */
export const PROFILE_AVATAR = '[data-testid="primaryColumn"] a[href*="/photo"] img[src*="profile_images"]';

/** Profile header items row (location, link, join date, etc.). */
export const PROFILE_HEADER_ITEMS = '[data-testid="UserProfileHeader_Items"]';

/** Fallback for finding the profile container. */
export const PROFILE_CONTAINER_FALLBACK = '[data-testid="primaryColumn"] > div > div';

// ---------------------------------------------------------------------------
// Navigation / branding
// ---------------------------------------------------------------------------

/** The logged-in user's profile link in the sidebar nav. */
export const SELF_PROFILE_LINK = '[data-testid="AppTabBar_Profile_Link"]';

/** The X / Twitter logo home link. */
export const HOME_LINK = 'h1 a[href="/home"]';

/** Class name applied to the replacement logo image. */
export const LOGO_REPLACEMENT_CLASS = 'milady-logo-replacement';

// ---------------------------------------------------------------------------
// Thread connector colors (used for reply-chain detection)
// ---------------------------------------------------------------------------

/** Vertical connector lines between threaded replies. */
export const THREAD_CONNECTOR = [
  // Light mode
  'div[style*="background-color: rgb(207, 217, 222)"]',
  'div[style*="background-color: rgb(239, 243, 244)"]',
  'div[style*="background-color: rgb(196, 207, 214)"]',
  // Dim mode
  'div[style*="background-color: rgb(56, 68, 77)"]',
  'div[style*="background-color: rgb(61, 73, 82)"]',
  // Dark mode
  'div[style*="background-color: rgb(51, 54, 57)"]',
  'div[style*="background-color: rgb(47, 51, 54)"]',
  'div[style*="background-color: rgb(66, 83, 100)"]',
].join(", ");
