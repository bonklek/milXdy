# Link Browser User Guide

Link Browser is an optional docked app that opens ordinary links in a small in-page browser panel instead of navigating away from the current page.

## Where To Find It

- Open the in-page **Apps** hub.
- Enable **Link Browser**.
- Pin **Links** if you want it visible on the side rail.

## Common Tasks

- Click a normal page link to open it in the Link Browser panel.
- Drag the panel header to reposition it.
- Resize the panel from its edges.
- Use **Refresh** to reload the embedded page.
- Use **Open in new tab** when a site blocks embedded display or when you want the full native page.
- Use modifier-clicks such as Ctrl-click or Cmd-click when you want the browser's native new-tab behavior.

## Notes

Link Browser does not fetch page contents through milXdy. It points a sandboxed iframe at the clicked `http` or `https` URL and stores the panel placement plus the most recent link URL locally.

Some websites block embedded display. When that happens, use the panel's open-in-tab control.
