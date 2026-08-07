import type { ManagedAgentSummary } from "@prompthub/shared/types";
import { AgentPiModelCatalogPanel } from "./AgentPiModelCatalogPanel";
import { AgentProviderProfileWorkbench } from "./AgentProviderProfileWorkbench";

/**
 * Shared Provider & Model entry point for every managed Agent.
 *
 * The workbench owns one product surface while platform adapters retain their
 * native read/write semantics. Pi currently supplies a catalog adapter; other
 * supported Agents supply the unified Provider Profile adapter.
 */
export function AgentProviderModelWorkbench({
  agent,
}: {
  agent: ManagedAgentSummary;
}) {
  return agent.id === "pi" ? (
    <AgentPiModelCatalogPanel agent={agent} />
  ) : (
    <AgentProviderProfileWorkbench agent={agent} />
  );
}
