import { describe, expect, it } from "vitest";
import type { AppReplyActionTemplate, AppSettingDefinition } from "../app-sdk/app-platform";
import { replyTemplateStorageDefaults, resolveReplyTemplates, reconcileReplySelection } from "./reply-action-templates";
const templates: AppReplyActionTemplate[] = [
  { id: "first", label: "first", text: "first", sendAfterInsert: true, sendAfterInsertStorageKey: "first.consent" },
  { id: "second", label: "second", text: "second", sendAfterInsert: true, sendAfterInsertStorageKey: "second.consent" },
  { id: "custom", label: "Custom", storageListKey: "phrases", sendAfterInsert: true, sendAfterInsertStorageKey: "custom.consent" },
];
const settings = [
  ...["first", "second", "custom"].map(id => ({ id, storage: { area: "local", key: id + ".consent" }, control: { type: "toggle" }, defaultValue: false })),
  { id: "phrases", storage: { area: "local", key: "phrases" }, control: { type: "textList", maxLength: 280, maxItems: 20 } },
] as AppSettingDefinition[];
describe("reply template send consent", () => {
  it("treats missing, malformed, and legacy manifest-only permission as type-only", () => {
    for (const value of [undefined, false, "true", 1, {}, []]) {
      expect(resolveReplyTemplates(templates, settings, { "first.consent": value }).every(row => !row.sendAfterInsert)).toBe(true);
    }
    expect(resolveReplyTemplates([{ id: "legacy", label: "legacy", text: "legacy", sendAfterInsert: true }], settings, {}).every(row => !row.sendAfterInsert)).toBe(true);
    expect(replyTemplateStorageDefaults(templates)["first.consent"]).toBe(false);
  });
  it("requires separate exact-true local default-off consent for each declared template", () => {
    const rows = resolveReplyTemplates(templates, settings, { "first.consent": true, phrases: ["custom value"] });
    expect(rows.map(row => [row.id, row.sendAfterInsert])).toEqual([["first", true], ["second", false], ["custom.0", false]]);
    expect(resolveReplyTemplates(templates, [], { "first.consent": true })[0].sendAfterInsert).toBe(false);
  });
  it("fails closed when two templates share a consent key", () => {
    const shared = templates.map(template => ({ ...template, sendAfterInsertStorageKey: "first.consent" }));
    expect(resolveReplyTemplates(shared, settings, { "first.consent": true }).every(row => !row.sendAfterInsert)).toBe(true);
  });
  it("honors revoked consent and never upgrades a previously displayed Insert row", () => {
    expect(reconcileReplySelection({ text: "milady", sendAfterInsert: true }, { text: "milady", sendAfterInsert: false })?.sendAfterInsert).toBe(false);
    expect(reconcileReplySelection({ text: "milady", sendAfterInsert: false }, { text: "milady", sendAfterInsert: true })?.sendAfterInsert).toBe(false);
    expect(reconcileReplySelection({ text: "milady", sendAfterInsert: true }, { text: "changed", sendAfterInsert: true })).toBeNull();
    expect(reconcileReplySelection({ text: "milady", sendAfterInsert: true }, undefined)).toBeNull();
  });
  it("expands bounded custom phrases only and applies only the declared Custom toggle", () => {
    const rows = resolveReplyTemplates(templates, settings, { "custom.consent": true, phrases: ["a", "", 5, "b", "x".repeat(281)] });
    expect(rows.map(row => [row.id, row.text, row.sendAfterInsert])).toEqual([["first", "first", false], ["second", "second", false], ["custom.0", "a", true], ["custom.1", "b", true]]);
  });
});
