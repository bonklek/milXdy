const presentVerbs: Record<string, string> = {
  Store: "Stores", Convert: "Converts", Add: "Adds", Continue: "Continues", Play: "Plays",
  Choose: "Chooses", Avoid: "Avoids", Include: "Includes", Use: "Uses", Scan: "Scans",
  Open: "Opens", Mark: "Marks", Display: "Displays", Show: "Shows", Mount: "Mounts",
  Reduce: "Reduces", Accelerate: "Accelerates", Turn: "Turns", Remove: "Removes",
  Keep: "Keeps", Give: "Gives", Round: "Rounds", Draw: "Draws", Put: "Puts",
  Enable: "Enables", Track: "Tracks", Animate: "Animates", Treat: "Treats", Hide: "Hides", Load: "Loads",
};
const explicitStatements: Record<string, readonly [string, string]> = {
  "post-reading.fetchFullQuotes": [
    "Does not fetch full quoted posts. Public quote sources use no browser cookies or session tokens.",
    "Fetches full quoted posts from public X/Twitter sources without browser cookies or session tokens.",
  ],
  "post-reading.useHandles": [
    "Does not read @handles; reads display names instead.",
    "Reads @handles instead of display names.",
  ],
  "remistats.likeAutoPoke": [
    "Does not poke the author on RemiliaNET when you like a post on X.",
    "Pokes the author on RemiliaNET when you like a post on X.",
  ],
  "remistats.pokeAutoLike": [
    "Does not like the post on X after a successful RemiliaNET poke.",
    "Likes the post on X after a successful RemiliaNET poke.",
  ],
  "wiki.maxLinksPerPostEnabled": [
    "Does not limit wiki links per post to the saved maximum.",
    "Limits wiki links per post to the saved maximum.",
  ],
  visualUseRemiliaProfileColor: [
    "Does not use your RemiliaNET profile color on X; Full uses your custom theme color or its default palette. Settings retain your profile accent.",
    "Uses your RemiliaNET profile color for the X background and accents on Full appearance. Settings use your profile accent on every preset.",
  ],
  visualSquareMedia: [
    "Does not square media corners; keeps images, videos, and quote cards rounded.",
    "Uses square corners on images, videos, and quote cards.",
  ],
  visualQuoteMediaGap: [
    "Does not add whitespace between media and quoted posts.",
    "Keeps whitespace between media and quoted posts.",
  ],
  visualTweetPngIncludeDate: [
    "Does not show the post date in exports; shows a link instead.",
    "Shows the post date in exports instead of a link.",
  ],
};

/** Describe the displayed checkbox state, including controls whose stored value is inverted. */
export function settingStateHelp(key: string, enabled: boolean, guidance: string): string {
  const explicit = explicitStatements[key];
  if (explicit) return explicit[enabled ? 1 : 0];
  const verb = guidance.match(/^([A-Z][a-z]+)\b/)?.[1];
  if (!verb || !presentVerbs[verb]) return guidance;
  return `${enabled ? presentVerbs[verb] : `Does not ${verb.toLowerCase()}`}${guidance.slice(verb.length)}`;
}
