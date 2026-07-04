import type { TwitterSurface } from "../scanner/twitter-scanner";

export type FeatureRuntimeContext = {
  featureId: string;
  scheduleScan: () => void;
  recordDiagnostic: (key: string, value: unknown) => void;
};

export type ContentFeatureModule = {
  id: string;
  boot: (context: FeatureRuntimeContext) => Promise<void> | void;
  enable?: () => Promise<void> | void;
  disable?: () => Promise<void> | void;
  onSurface?: (surface: TwitterSurface) => Promise<void> | void;
  dispose?: () => Promise<void> | void;
};

