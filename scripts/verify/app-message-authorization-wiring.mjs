import { readFileSync } from "node:fs";
import ts from "typescript";

export function verifyAppMessageAuthorizationWiring() {
  const runtime = parse("src/platform/runtime/content-runtime.ts");
  const dispatch = parse("src/platform/runtime/background-message-dispatch.ts");
  const send = findFunction(runtime, "sendAppMessage");
  const dispatcher = findFunction(dispatch, "dispatchAuthorizedBackgroundMessage");
  const sendText = send.getText(runtime);
  const dispatchText = dispatcher.getText(dispatch);

  assert(sendText.includes("dispatchAuthorizedBackgroundMessage(message, app.background?.messageTypes"), "sendAppMessage must delegate to the authorization-first dispatcher");
  assert(/denied\s*\([^)]*\)\s*{[\s\S]*recordDeniedAppMessage/.test(sendText), "denied dispatch must record diagnostics");
  assert(/authorized\s*\([^)]*\)\s*{[\s\S]*state\.networkQueue\.push\(task\)/.test(sendText), "only the authorized callback may queue a network task");
  const authorizationAt = dispatchText.indexOf("authorizeBackgroundMessage(");
  const queueCallbackAt = dispatchText.indexOf("handlers.authorized(");
  assert(authorizationAt >= 0 && queueCallbackAt > authorizationAt, "dispatcher must authorize before invoking the queue callback");
}

function findFunction(sourceFile, name) {
  let found = null;
  visit(sourceFile);
  if (!found) throw new Error(`${sourceFile.fileName}: missing function ${name}`);
  return found;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    if (!found) ts.forEachChild(node, visit);
  }
}

function parse(file) {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
