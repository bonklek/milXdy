import { onComposerAction } from "../../packages/maintainer/tweet-composer-kit/src/content.js";

export async function verifyMakerPanel(assert: (value: unknown, message: string) => void): Promise<void> {
  const style = document.createElement("style");
  style.textContent = '.maker-fixture,.maker-fixture *{box-sizing:border-box}.maker-fixture{margin:0 0 20px}.maker-fixture button{font:700 12px/1 Arial}.maker-fixture input{font:inherit}';
  document.head.append(style);
  for (const theme of ["light", "dark"]) for (const width of [244, 620]) for (const font of [14, 20]) {
    document.documentElement.dataset.milxdySettingsTheme = theme;
    const panel = document.createElement("div"); panel.className = "maker-fixture";
    panel.style.cssText = `width:${width}px;font-size:${font}px`;
    document.body.append(panel);
    let complete: (value: {ok:boolean;error?:string}) => void = () => undefined;
    const controller = new AbortController();
    await onComposerAction({panel,signal:controller.signal,externalHandoffs:[{id:"remilio-maker"},{id:"milady-maker"}],launchExternalHandoff:()=>new Promise(resolve=>{complete=resolve;}),queryRemoteService:undefined,suggestRemoteQueryFacets:undefined,attachRemoteQueryResult:undefined});
    const root = panel.querySelector<HTMLElement>(".tweet-composer-kit__composer-panel")!;
    root.style.fontSize = `${font}px`;
    const initial = root.getBoundingClientRect().width;
    const label = `${theme}/${width}/${font}`;
    assert(initial === Math.min(292,width,window.innerWidth-16),`${label}: maker panel has a fixed bounded width`);
    (panel.querySelector('[aria-label="Select Redacted Remilio Babies Maker"]') as HTMLButtonElement).click();
    const radio = panel.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]; radio.checked = true; radio.dispatchEvent(new Event("change"));
    const generate = panel.querySelector<HTMLButtonElement>(".tweet-composer-kit__generate")!;
    assert(!generate.disabled,`${label}: maker selection remains usable`);
    generate.click();
    assert(root.getBoundingClientRect().width === initial,`${label}: generating status cannot widen panel`);
    complete({ok:true}); await Promise.resolve(); await Promise.resolve();
    assert(root.getBoundingClientRect().width === initial,`${label}: long success message cannot widen panel`);
    assert(root.scrollWidth <= root.clientWidth + 1,`${label}: panel has no horizontal overflow`);
    for (const selector of [".tweet-composer-kit__caption-fields",".tweet-composer-kit__maker-row",".tweet-composer-kit__generate",".tweet-composer-kit__media-picker"]) {
      const rect = panel.querySelector<HTMLElement>(selector)!.getBoundingClientRect(); const bounds = root.getBoundingClientRect();
      assert(rect.left >= bounds.left && rect.right <= bounds.right,`${label}: ${selector} stays within panel`);
    }
    controller.abort(); panel.remove();
  }
  delete document.documentElement.dataset.milxdySettingsTheme;
}
