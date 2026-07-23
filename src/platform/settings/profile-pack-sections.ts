export type ProfilePackSection = "appearance" | "performance" | "apps" | "rail" | "layout";

const SUPPORTED_IMPORT_SECTIONS = new Set<ProfilePackSection>(["appearance", "performance"]);

export function ignoredProfilePackSections(pack: { sections: ProfilePackSection[] }): ProfilePackSection[] {
  return pack.sections.filter((section) => !SUPPORTED_IMPORT_SECTIONS.has(section));
}
