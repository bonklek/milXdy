type RefreshDependencies = {
  confirmedPokeTargets: { clear(): void }; pokeTargetLatestRequests: { clear(): void };
  fillActionPokeSlot: (element: Element, username: string) => unknown;
  isEnabled: () => boolean;
  runtimeScheduler: { timeout(callback: () => void, delay: number): unknown };
  lifecycleActive: () => boolean;
  surfaceIsInsideQuoteTweet: (element: Element) => boolean;
  remistatsReconciliationPolicy: () => { limit: number };
  processSurfaceElement: (element: Element) => unknown;
  insertProfileBadge: () => unknown;
};
export function refreshPokeAuthentication({ confirmedPokeTargets, pokeTargetLatestRequests, fillActionPokeSlot, isEnabled, runtimeScheduler, lifecycleActive, surfaceIsInsideQuoteTweet, remistatsReconciliationPolicy, processSurfaceElement, insertProfileBadge }: RefreshDependencies) {
      // This public control record changes after sign-in/sign-out. Never read
      // credential storage or infer permission from optional public badges.
      confirmedPokeTargets.clear();
      pokeTargetLatestRequests.clear();
      for (const button of document.querySelectorAll('[data-reminet-poke]')) button.remove();
      for (const group of document.querySelectorAll('[data-reminet-action-poke-group]')) {
        fillActionPokeSlot(group, '');
      }
      if (isEnabled()) {
        runtimeScheduler.timeout(() => {
          if (!lifecycleActive() || !isEnabled()) return;
          const surfaces = Array.from(document.querySelectorAll('[data-testid="tweet"], [data-testid="UserCell"], [data-testid="user-cell"]'))
            .filter(element => !surfaceIsInsideQuoteTweet(element))
            .slice(0, remistatsReconciliationPolicy().limit);
          // Revisit existing badges too: the ordinary reconciliation skips them.
          for (const element of surfaces) void processSurfaceElement(element);
          void insertProfileBadge();
        }, 250);
      }
}
