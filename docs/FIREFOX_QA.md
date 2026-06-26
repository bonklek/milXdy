# Firefox Build - QA Checklist

Run after each `npm run build:firefox`, before shipping.

## 1. Automated lint

```bash
npm run lint:firefox
```

Resolve all errors before manual QA. A `setBadgeTextColor` warning is expected
on Firefox MV3 (unsupported there; the `browserAction` wrapper calls it safely).

## 2. Load in Firefox

1. `about:debugging` -> This Firefox -> Load Temporary Add-on...
2. Select `dist/firefox/manifest.json`.
3. Confirm it loads with no errors in the console.

## 3. Feature checklist

| Area | Steps | Pass? |
|---|---|---|
| Popup | Click the milXdy toolbar icon; all tabs render (Suite/Wiki/Reader/RemiNet/Maxxer/Diag). | [ ] |
| Content bootstrap | Open `https://x.com`; no console errors on load. | [ ] |
| RemiNet Chat | Enable RemiNet; visit a profile with RemiStats data; badge + tooltip appear. | [ ] |
| OCR | Enable Postreader + Image OCR; read a tweet image with text; OCR passes 5% and reads it. | [ ] |
| ONNX detection | Set Maxxer to Debug; refresh + scroll; Diag shows avatar checks > 0. | [ ] |
| Beetol auth/session | Log in via RemiNet panel; session status shows signed in; poke button appears. | [ ] |

## 4. Known Firefox MV3 differences

- `chrome.action.setBadgeTextColor` is unsupported on Firefox; the wrapper calls
  it safely and the badge falls back to default contrast colours.
- Background runs as a module script array (`background.scripts`), not a service
  worker; all imports must be static ES module imports (already the case here).
