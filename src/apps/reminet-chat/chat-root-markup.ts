export const CHAT_MEDIA_UNAVAILABLE = "Images and video cannot be sent through the official Chat API. Send media on RemiliaNET; your text draft stays here.";

export function chatRootMarkup(jumpControls: string): string {
  return `
    <div class="milxdy-chat-card milxdy-overlay-app-card">
      <header class="milxdy-chat-header milxdy-overlay-app-header">
        <div>
          <strong>RemiliaNET Chat</strong>
          <span data-role="status">Connecting...</span>
        </div>
        <div class="milxdy-chat-header-actions">
          <button type="button" data-role="refresh" title="Refresh chat">Refresh</button>
          <button type="button" data-role="minimize" title="Minimize chat" aria-label="Minimize chat">-</button>
          <button type="button" data-role="close" title="Close chat" aria-label="Close chat">×</button>
        </div>
      </header>
      <div class="milxdy-chat-surface-notice">RemiNet Global Chat</div>
      <div class="milxdy-chat-load-older" data-role="load-older" hidden></div>
      <div class="milxdy-chat-messages" data-role="messages" tabindex="0" aria-label="Chat messages"></div>
      ${jumpControls}
      <div class="milxdy-chat-attachment-preview" data-role="attachments" hidden></div>
      <div class="milxdy-chat-error" data-role="error" hidden></div>
      <div class="milxdy-chat-reply-preview" data-role="reply" hidden></div>
      <form class="milxdy-chat-composer" data-role="form">
        <input data-role="file" type="file" accept="image/*,video/mp4,video/webm,video/quicktime" hidden>
        <button data-role="attach" type="button" title="Official Chat supports text and replies. Use RemiliaNET to send images and video." aria-label="Media sending unavailable through the official Chat API" disabled>+</button>
        <input data-role="input" type="text" maxlength="8192" autocomplete="off" placeholder="Say something">
        <button data-role="send" type="submit">Send</button>
      </form>
      <div class="milxdy-chat-media-availability"><span>Images and video require the RemiliaNET website.</span> <a href="https://www.remilia.net/" target="_blank" rel="noopener noreferrer" aria-label="Send images and video on RemiliaNET">Send media on RemiliaNET ↗</a></div>
      <div class="milxdy-chat-resize-grip" data-role="resize" data-resize-axis="y" title="Drag to resize chat height"></div>
      <div class="milxdy-chat-resize-corner milxdy-chat-resize-corner-left" data-role="resize" data-resize-axis="both" data-resize-side="left" title="Drag to resize chat"></div>
      <div class="milxdy-chat-resize-corner milxdy-chat-resize-corner-right" data-role="resize" data-resize-axis="both" data-resize-side="right" title="Drag to resize chat"></div>
      <div class="milxdy-chat-resize-edge milxdy-chat-resize-edge-side" data-role="resize" data-resize-axis="x" title="Drag to resize chat width"></div>
    </div>
  `;
}
