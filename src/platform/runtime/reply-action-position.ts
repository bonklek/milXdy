export type ReplyActionRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ReplyActionPanelPosition = {
  left: number;
  top: number;
  maxHeight: number;
  hidden: boolean;
};

type ResolveReplyActionPanelPositionOptions = {
  anchor: ReplyActionRect;
  panelWidth: number;
  viewportWidth: number;
  viewportHeight: number;
  stickyHeaderBottom: number;
  gap?: number;
  viewportPadding?: number;
};

export function resolveReplyActionPanelPosition({
  anchor,
  panelWidth,
  viewportWidth,
  viewportHeight,
  stickyHeaderBottom,
  gap = 8,
  viewportPadding = 8,
}: ResolveReplyActionPanelPositionOptions): ReplyActionPanelPosition {
  const availableWidth = Math.max(0, viewportWidth - (viewportPadding * 2));
  const measuredWidth = panelWidth > 0 ? panelWidth : Math.min(300, availableWidth);
  const boundedWidth = Math.min(measuredWidth, availableWidth);
  const left = Math.max(viewportPadding, Math.min(anchor.left, viewportWidth - boundedWidth - viewportPadding));
  const top = anchor.bottom + gap;
  const anchorOutsideViewport = anchor.right <= 0
    || anchor.left >= viewportWidth
    || anchor.bottom <= stickyHeaderBottom
    || anchor.top >= viewportHeight;
  const hidden = anchorOutsideViewport || top < stickyHeaderBottom;

  return {
    left,
    top,
    maxHeight: Math.max(48, viewportHeight - Math.max(viewportPadding, top) - (viewportPadding * 2)),
    hidden,
  };
}
