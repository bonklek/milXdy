/**
 * Compile-time drift check: the internal host contract must remain assignable
 * to the public portable contract. The public SDK itself never imports this
 * private source tree.
 */
import type {
  MilxdyContentAppContext as InternalContext,
  MilxdyContentAppModule as InternalModule,
} from "./app-platform";
import type {
  MilxdyContentAppContext as PublicContext,
  MilxdyContentAppModule as PublicModule,
} from "../../../sdk/types/index";

declare const internalContext: InternalContext;
declare const publicAuthoredModule: PublicModule;

const publicContext: PublicContext = internalContext;
// A module authored only against the public facade is safe for the richer host.
const internalModule: InternalModule = publicAuthoredModule;

void publicContext;
void internalModule;
