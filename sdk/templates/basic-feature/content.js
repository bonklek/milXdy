/** @type {import("../../types/index.d.ts").MilxdyContentAppContext | null} */
let appContext = null;

/** @param {import("../../types/index.d.ts").MilxdyContentAppContext} context */
export async function boot(context) {
  appContext = context;
  context.recordDiagnostic("starter.booted", true);
  context.addDisposable(() => {
    appContext = null;
  });
}

/** @param {import("../../types/index.d.ts").MilxdyRouteChange} route */
export function onRouteChange(route) {
  appContext?.recordDiagnostic("starter.pathname", route.pathname);
}

export function dispose() {
  appContext = null;
}
