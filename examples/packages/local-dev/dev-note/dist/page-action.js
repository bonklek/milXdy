const host = globalThis.__MILXDY_PAGE_CONTEXT_ACTION__;

if (host?.appId === "dev-note" && host.actionId === "show-note") {
  const note = document.createElement("aside");
  note.textContent = "Developer Note page action invoked.";
  note.dataset.milxdyDevNote = "page-action";
  document.documentElement.append(note);
}
