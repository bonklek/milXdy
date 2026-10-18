/** Recognize the concrete manifest-owned popup renderer, never assume metadata alone creates a control. */
export function generatedPopupMirrors(registry, { popupSource, popupHtml, bundledSource }) {
  const requiredRendererContracts = [
    /getElementById\(soundsOnly\s*\?\s*"appSoundGroups"\s*:\s*"bundledAppsList"\)/u,
    /control\.dataset\.bundledSetting\s*=\s*setting\.id/u,
    /chrome\.storage\[setting\.storage\.area\]/u,
    /storage\.get\(setting\.storage\.key\)/u,
    /storage\.set\(\{\s*\[setting\.storage\.key\]:\s*bundledSettingPatch/u,
    /setting\.storage\.property\s*\?\s*\{\s*\.\.\.record\(stored\),\s*\[setting\.storage\.property\]:\s*value\s*\}/u,
    /root\.append\(createBundledAppCard\(app,\s*soundsOnly,\s*controls,\s*voices\)\)/u,
    /appendBundledSetting\(setting,\s*app,\s*body,\s*status,\s*soundsOnly,\s*controls,\s*voices\)/u,
    /\["action",\s*"status"\]\.includes\(setting\.control\.type\)/u,
  ];
  const mirrors = new Map();
  const compact = bundledSource.replace(/\s/gu, "");
  if (!compact.includes('for(constsettingof(soundsOnly?soundSettings:(app.settings??[]).filter(setting=>!soundSettings.includes(setting))))')) return mirrors;
  if (!compact.includes('app.id==="post-reading"?setting.id==="post-reading.endOfTweetDing":setting.presets?.includes("audio")')) return mirrors;
  if (!requiredRendererContracts.every(pattern => pattern.test(bundledSource))) return mirrors;
  const normal = /setupBundledAppSettings\(FIRST_PARTY_APPS\)/u.test(popupSource) && /id="bundledAppsList"/u.test(popupHtml);
  const sounds = /setupBundledAppSettings\(FIRST_PARTY_APPS,\s*true\)/u.test(popupSource) && /id="appSoundGroups"/u.test(popupHtml);
  if (!/from\s+"\.\/bundled-app-settings"/u.test(popupSource)) return mirrors;
  for (const app of registry) for (const setting of app.settings || []) {
    if (["action", "status"].includes(setting.control?.type)) continue;
    const audio = app.id === "post-reading" ? setting.id === "post-reading.endOfTweetDing" : setting.presets?.includes("audio");
    if (audio ? sounds : normal) mirrors.set(setting.id, { ...setting.storage });
  }
  return mirrors;
}
