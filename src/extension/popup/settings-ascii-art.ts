export type AsciiArt = { id: string; text: string };

// Original, plain-ASCII designs in several aspect ratios.
export const SETTINGS_ASCII_ART: readonly AsciiArt[] = [
  { id: "orbit", text: [
    "                   .       *       .                   ",
    "        .       .-----------------------.       .        ",
    "             .-'      .         .        '-.             ",
    "      *    .'       .      .-.       .      '.    *       ",
    "----------(--------------(   )---------------)----------",
    "           '.       .     '-'     .        .'           ",
    "             '-.       .       .       .-'             ",
    "                '---------------------'                ",
  ].join("\n") },
  { id: "garden", text: [
    "        _              _                 _        ",
    "      _(_)_          _(_)_             _(_)_      ",
    "     (_)@(_)        (_)@(_)           (_)@(_)     ",
    "       (_)            (_)               (_)       ",
    "        |     /\       |       /\        |        ",
    "     \\ | /  /  \   \\ | /    /  \    \\ | /     ",
    "      \\|/  /____\   \\|/    /____\    \\|/      ",
    "_______|______________|_________________|________",
  ].join("\n") },
  { id: "moth", text: [
    "       .     \   /     .       ",
    "    .-' '-.   \ /   .-' '-.    ",
    "  .' .--.  '.  V  .'  .--. '.  ",
    " / .'    '.  \ | /  .'    '. \ ",
    "| (   ()   )  \|/  (   ()   ) |",
    " \ '.    .'   /|\   '.    .' / ",
    "  '. '--'  .'/ | \'.  '--' .'  ",
    "    '-.__.-'   |   '-.__.-'    ",
    "       /  \    |    /  \       ",
    "      / () \   |   / () \      ",
    "      '.__.'   |   '.__.'      ",
  ].join("\n") },
  { id: "temple", text: [
    "                    /\                    ",
    "                   /  \                   ",
    "                  /____\                  ",
    "           ______/______\______           ",
    "          /____________________\          ",
    "            ||  ||  ||  ||  ||            ",
    "            ||  ||  ||  ||  ||            ",
    "            ||  ||  ||  ||  ||            ",
    "          __||__||__||__||__||__          ",
    "         /______________________\         ",
    "        /________________________\        ",
  ].join("\n") },
  { id: "stars", text: [
    " .       *       .        +        .       *       . ",
    "     +       .       *         .       +       .     ",
    " .       .       +        *        .       .       + ",
  ].join("\n") },
];

export function fitAsciiArt(width: number, height: number, characterWidth = 0.6, lineHeight = 1.08,
  library: readonly AsciiArt[] = SETTINGS_ASCII_ART): { art: AsciiArt; fontSize: number } | null {
  if (width <= 0 || height < 32 || characterWidth <= 0 || lineHeight <= 0) return null;
  let best: { art: AsciiArt; fontSize: number; score: number } | null = null;
  for (const art of library) {
    const lines = art.text.split("\n");
    const columns = Math.max(...lines.map(line => line.length));
    if (!columns) continue;
    const fontSize = Math.min(16, width * 0.94 / (columns * characterWidth), (height - 12) / (lines.length * lineHeight));
    if (fontSize < 8) continue;
    const score = columns * characterWidth * lines.length * lineHeight * fontSize * fontSize;
    if (!best || score > best.score) best = { art, fontSize, score };
  }
  return best ? { art: best.art, fontSize: best.fontSize } : null;
}

export function setupSettingsAsciiArt(): void {
  const app = document.querySelector<HTMLElement>("main.app");
  if (!app) return;
  const filler = document.createElement("div");
  filler.className = "settings-ascii-art";
  filler.setAttribute("aria-hidden", "true");
  filler.hidden = true;
  const pre = document.createElement("pre");
  filler.append(pre);
  app.append(filler);
  const context = document.createElement("canvas").getContext("2d");
  if (context) context.font = "100px monospace";
  const characterWidth = context ? context.measureText("M").width / 100 : 0.6;
  let frame = 0;
  const render = () => {
    frame = 0;
    const panel = app.querySelector<HTMLElement>(".panel.is-active");
    if (!panel) { filler.hidden = true; return; }
    const panelBox = panel.getBoundingClientRect();
    const appBox = app.getBoundingClientRect();
    const viewportHeight = Math.min(document.documentElement.clientHeight, document.body.clientHeight);
    const height = viewportHeight - (panelBox.bottom + window.scrollY) - 20;
    const fitted = fitAsciiArt(panelBox.width, height, characterWidth);
    filler.hidden = !fitted;
    if (!fitted) return;
    filler.style.top = `${panelBox.bottom - appBox.top + 8}px`;
    filler.style.left = `${panelBox.left - appBox.left}px`;
    filler.style.width = `${panelBox.width}px`;
    filler.style.height = `${height}px`;
    pre.style.fontSize = `${fitted.fontSize}px`;
    if (pre.dataset.art !== fitted.art.id) { pre.dataset.art = fitted.art.id; pre.textContent = fitted.art.text; }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(render); };
  const resize = new ResizeObserver(schedule);
  resize.observe(app);
  resize.observe(document.documentElement);
  for (const panel of app.querySelectorAll(".panel")) resize.observe(panel);
  const changes = new MutationObserver(records => {
    if (records.some(record => !filler.contains(record.target))) schedule();
  });
  changes.observe(app, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["hidden", "class", "open", "style"] });
  window.addEventListener("resize", schedule);
  window.addEventListener("pagehide", () => {
    resize.disconnect(); changes.disconnect(); window.removeEventListener("resize", schedule);
    if (frame) cancelAnimationFrame(frame);
  }, { once: true });
  schedule();
}
