export function renderLoadOlderButton(loadingOlder: boolean): string {
  const disabled = loadingOlder ? " disabled" : "";
  const label = loadingOlder ? "Loading..." : "Show more";
  return `
    <div class="milxdy-chat-load-older">
      <button type="button" data-chat-action="load-older"${disabled}>${label}</button>
    </div>
  `;
}
