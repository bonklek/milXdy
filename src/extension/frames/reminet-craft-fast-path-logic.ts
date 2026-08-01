export type CraftingSlotState = Readonly<Record<string, string | null | undefined>>;

export function nextAvailableCraftingSlot(
  slotIds: readonly string[],
  craftingSlots: CraftingSlotState,
): string | null {
  return slotIds.find((slotId) => !craftingSlots[slotId]) || null;
}

export function hammerSlotIsAvailable(selectedHammer: string | null | undefined): boolean {
  return !selectedHammer;
}

export function sacrificeSlotIsAvailable(
  selectedSacrifice: string | null | undefined,
): boolean {
  return !selectedSacrifice;
}

export function keyboardPlacementRequested(event: {
  key: string;
  shiftKey: boolean;
  repeat: boolean;
}): boolean {
  return event.key === "Enter" && event.shiftKey && !event.repeat;
}

type ActivationTimer = number;

export type CraftActivationResult =
  | "inspection-pending"
  | "inspected"
  | "placed";

export function createCraftActivationController<Item>(options: {
  delayMs: number;
  now: () => number;
  schedule: (handler: () => void, delayMs: number) => ActivationTimer;
  cancel: (timer: ActivationTimer) => void;
  inspect: (item: Item) => void;
  place: (item: Item) => boolean;
}) {
  let pending: { item: Item; timer: ActivationTimer } | null = null;
  let suppressUntil = 0;

  return {
    pointerDown(item: Item): CraftActivationResult {
      if (pending?.item === item) {
        options.cancel(pending.timer);
        pending = null;
        suppressUntil = options.now() + options.delayMs;
        if (options.place(item)) return "placed";
        options.inspect(item);
        return "inspected";
      }

      if (pending) {
        options.cancel(pending.timer);
        options.inspect(pending.item);
      }

      const timer = options.schedule(() => {
        if (pending?.item !== item) return;
        pending = null;
        options.inspect(item);
      }, options.delayMs);
      pending = { item, timer };
      return "inspection-pending";
    },

    keyboardPlace(item: Item): CraftActivationResult {
      if (pending?.item === item) {
        options.cancel(pending.timer);
        pending = null;
      }
      suppressUntil = options.now() + options.delayMs;
      if (options.place(item)) return "placed";
      options.inspect(item);
      return "inspected";
    },

    shouldSuppress(item: Item): boolean {
      return pending?.item === item || options.now() < suppressUntil;
    },

    dispose(): void {
      if (pending) options.cancel(pending.timer);
      pending = null;
      suppressUntil = 0;
    },
  };
}

export function createLocalChatMarkerDismissals() {
  const dismissed = new Set<"last-read" | "present">();
  return {
    dismiss(kind: "last-read" | "present"): void {
      dismissed.add(kind);
    },
    isDismissed(kind: "last-read" | "present"): boolean {
      return dismissed.has(kind);
    },
  };
}
