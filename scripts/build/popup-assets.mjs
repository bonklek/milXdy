import { copyFile, cp } from 'node:fs/promises';
/** Keep the popup document, presentation, and local login assets in one build step. */
export async function copyPopupAssets(output) {
  await Promise.all([
    copyFile('assets/extension/popup/popup.html', `${output}/popup.html`),
    copyFile('assets/extension/popup/popup.css', `${output}/popup.css`),
    copyFile('assets/extension/popup/connection-status.svg', `${output}/connection-status.svg`),
    cp('assets/extension/popup/remilia-login', `${output}/remilia-login`, { recursive: true }),
  ]);
}
