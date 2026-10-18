import type { AppReplyActionTemplate, AppSettingDefinition } from "../app-sdk/app-platform";

export function replyTemplateStorageDefaults(templates: readonly AppReplyActionTemplate[]): Record<string, unknown> {
  return Object.fromEntries(templates.flatMap((template) => [template.storageKey, template.storageListKey, template.sendAfterInsertStorageKey])
    .filter((key): key is string => Boolean(key)).map((key) => [key, false]));
}

export function resolveReplyTemplates(templates: readonly AppReplyActionTemplate[], settings: readonly AppSettingDefinition[], stored: Record<string, unknown> | null) {
  return templates.flatMap((template) => {
    const consent = settings.find((setting) => setting.storage.key === template.sendAfterInsertStorageKey
      && setting.storage.area === "local" && !setting.storage.property && setting.control.type === "toggle" && setting.defaultValue === false);
    const uniqueConsent = templates.filter((candidate) => candidate.sendAfterInsertStorageKey === template.sendAfterInsertStorageKey).length === 1;
    const sendAfterInsert = template.sendAfterInsert === true && uniqueConsent && Boolean(consent) && stored?.[template.sendAfterInsertStorageKey!] === true;
    if (template.storageListKey) {
      const setting = settings.find((candidate) => candidate.storage.key === template.storageListKey && candidate.control.type === "textList");
      const values = stored?.[template.storageListKey];
      return (Array.isArray(values) ? values : []).filter((value): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= (setting?.control.maxLength || 0))
        .slice(0, setting?.control.maxItems || 0).map((text, index) => ({ id: `${template.id}.${index}`, label: text, text, sendAfterInsert }));
    }
    const text = template.text ?? String(template.storageKey ? stored?.[template.storageKey] || "" : "");
    return template.storageKey && !text.trim() ? [] : [{ id: template.id, label: template.label, text, sendAfterInsert }];
  });
}

/** Keep the action the user saw: a late opt-in cannot turn an Insert row into a send. */
export function reconcileReplySelection(selected: { text: string; sendAfterInsert: boolean }, current: { text: string; sendAfterInsert: boolean } | undefined) {
  return current && current.text === selected.text ? { ...current, sendAfterInsert: selected.sendAfterInsert && current.sendAfterInsert } : null;
}
