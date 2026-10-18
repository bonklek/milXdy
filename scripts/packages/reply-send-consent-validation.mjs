/** A reviewed manifest can permit sending, but only distinct default-off settings grant user consent. */
export function verifyReplySendConsent(id, manifest, templates, errors) {
  const consentKeys = new Set();
  for (const template of templates) {
    if (template.sendAfterInsert !== undefined && typeof template.sendAfterInsert !== "boolean") errors.push(`${id}: replyAction sendAfterInsert must be boolean when declared`);
    if (template.sendAfterInsertStorageKey !== undefined) {
      const key = template.sendAfterInsertStorageKey;
      if (consentKeys.has(key)) errors.push(`${id}: replyAction send consent must be separate for each template`);
      consentKeys.add(key);
      const setting = manifest.settings?.find((candidate) => candidate.storage?.key === key && candidate.storage?.area === "local" && !candidate.storage?.property && candidate.control?.type === "toggle" && candidate.defaultValue === false);
      if (typeof key !== "string" || !manifest.storageKeys?.local?.includes(key) || !setting) errors.push(`${id}: replyAction send consent requires a declared local default-false toggle`);
    }
    if (template.sendAfterInsert === true && !template.sendAfterInsertStorageKey) errors.push(`${id}: replyAction sendAfterInsert requires per-template persisted consent`);
  }
}

export function verifyReplyAction(id, manifest, errors) {
  const action = manifest.replyAction;
  if (!action) return;
  if (!manifest.loadTriggers?.includes("userAction")) errors.push(`${id}: replyAction packages must declare the userAction load trigger`);
  if (!manifest.surfaces?.includes("replyAction")) errors.push(`${id}: replyAction packages must declare the replyAction surface`);
  const templates = action.templates;
  if (!Array.isArray(templates) || templates.length === 0 || templates.length > 6) {
    errors.push(`${id}: replyAction requires between one and six templates`);
    return;
  }
  const ids = new Set();
  for (const template of templates) {
    if (!template?.id || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(template.id) || ids.has(template.id)) errors.push(`${id}: replyAction template ids must be unique safe identifiers`);
    ids.add(template?.id);
    if (!template?.label || typeof template.label !== "string") errors.push(`${id}: replyAction templates require a label`);
    const hasText = typeof template?.text === "string";
    const hasStorageKey = typeof template?.storageKey === "string" && template.storageKey.length > 0;
    const hasStorageListKey = typeof template?.storageListKey === "string" && template.storageListKey.length > 0;
    if ([hasText, hasStorageKey, hasStorageListKey].filter(Boolean).length !== 1) errors.push(`${id}: replyAction template must declare exactly one of text, storageKey, or storageListKey`);
    if (hasStorageKey && !Object.values(manifest.storageKeys || {}).flat().includes(template.storageKey)) errors.push(`${id}: replyAction storageKey must be declared in storageKeys`);
    if (hasStorageListKey && !Object.values(manifest.storageKeys || {}).flat().includes(template.storageListKey)) errors.push(`${id}: replyAction storageListKey must be declared in storageKeys`);

  }
  verifyReplySendConsent(id, manifest, templates, errors);
}
