export type ComposerActionButtonIdentity = {
  appId: string;
  hostAction: string | null;
};

type ComposerActionButtonLike = {
  dataset: {
    appId?: string;
    hostAction?: string;
  };
};

export function composerActionButtonIdentity(button: ComposerActionButtonLike | null): ComposerActionButtonIdentity | null {
  const appId = button?.dataset.appId?.trim() || "";
  if (!appId) return null;
  return {
    appId,
    hostAction: button?.dataset.hostAction?.trim() || null,
  };
}

export function findPackageComposerActionButton<T extends ComposerActionButtonLike>(
  buttons: Iterable<T>,
  appId: string,
): T | null {
  for (const button of buttons) {
    const identity = composerActionButtonIdentity(button);
    if (identity?.appId === appId && identity.hostAction === null) return button;
  }
  return null;
}
