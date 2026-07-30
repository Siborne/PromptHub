import {
  createProviderProbeDispatcher,
  type ProviderProbeOptions,
} from "./agent-provider-probe-dispatch";

export type KimiProviderProbeOptions = ProviderProbeOptions;

export function createKimiProviderProbeDispatcher(
  options: KimiProviderProbeOptions,
): ReturnType<typeof createProviderProbeDispatcher> {
  return createProviderProbeDispatcher("kimi", options);
}
