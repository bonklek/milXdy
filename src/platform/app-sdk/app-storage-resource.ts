import type { AppSettingStorageArea } from "./app-platform";

export type AppStorageResourceKind = "settings" | "cache" | "authoredData" | "sensitiveData";
export type AppStorageResourceReset = "reset" | "preserve";

export type AppStorageResource = {
  area: AppSettingStorageArea;
  key: string;
  kind: AppStorageResourceKind;
  /** Settings reset by default; other resource kinds require this explicit opt-in. */
  reset?: AppStorageResourceReset;
};
