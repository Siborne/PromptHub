import type { McpServerConfig } from "@prompthub/shared/types/mcp";
import { updateMcpTags, type McpBatchTagMode } from "./batch-utils";
import type { McpErrorReporter } from "./mcp-manager-action-utils";
import type { McpManagerBindings } from "./useMcpManagerBindings";
import type { McpLibraryModel } from "./useMcpLibraryModel";
import type { McpManagerState } from "./useMcpManagerState";

interface McpLibraryMutationActionOptions {
  bindings: McpManagerBindings;
  library: McpLibraryModel;
  reportError: McpErrorReporter;
  state: McpManagerState;
}

function createToggleFavorite(
  updateServer: McpManagerBindings["mcpStore"]["updateServer"],
  reportError: McpErrorReporter,
) {
  return async (server: McpServerConfig) => {
    try {
      await updateServer(server.id, { isFavorite: !server.isFavorite });
    } catch (error) {
      reportError(error);
    }
  };
}

function createBatchFavorite(
  library: McpLibraryModel,
  state: McpManagerState,
  updateServer: McpManagerBindings["mcpStore"]["updateServer"],
  reportError: McpErrorReporter,
) {
  return async () => {
    const shouldFavorite = library.selectedServers.some(
      (server) => !server.isFavorite,
    );
    try {
      for (const server of library.selectedServers) {
        if (server.isFavorite !== shouldFavorite) {
          await updateServer(server.id, { isFavorite: shouldFavorite });
        }
      }
      state.setSelectedServerIds(new Set());
    } catch (error) {
      reportError(error);
    }
  };
}

function createBatchTagDialogOpen(
  library: McpLibraryModel,
  state: McpManagerState,
) {
  return () => {
    if (library.selectedServers.length > 0) state.setShowBatchTagDialog(true);
  };
}

function createBatchDeployDialogOpen(
  library: McpLibraryModel,
  state: McpManagerState,
) {
  return () => {
    if (library.selectedServers.length === 0) return;
    state.setQuickDeployServerId(null);
    state.setShowBatchDeployDialog(true);
  };
}

function createQuickDeploy(state: McpManagerState) {
  return (server: McpServerConfig) => {
    state.setShowBatchDeployDialog(false);
    state.setQuickDeployServerId(server.id);
  };
}

function createCloseDeployDialog(state: McpManagerState) {
  return () => {
    state.setShowBatchDeployDialog(false);
    state.setQuickDeployServerId(null);
  };
}

function createDeleteConfirmOpen(state: McpManagerState) {
  return (serverIds: string[], serverNames: string[]) => {
    state.setDeleteConfirm({ isOpen: true, serverIds, serverNames });
  };
}

function createDeleteConfirmClose(state: McpManagerState) {
  return () => {
    if (state.isDeletingServers) return;
    state.setDeleteConfirm({ isOpen: false, serverIds: [], serverNames: [] });
  };
}

function createBatchDelete(
  library: McpLibraryModel,
  openDeleteConfirm: (serverIds: string[], serverNames: string[]) => void,
) {
  return () => {
    if (library.selectedServers.length === 0) return;
    openDeleteConfirm(
      library.selectedServers.map((server) => server.id),
      library.selectedServers.map(
        (server) => server.displayName || server.name,
      ),
    );
  };
}

function createSingleDelete(
  servers: McpServerConfig[],
  openDeleteConfirm: (serverIds: string[], serverNames: string[]) => void,
) {
  return async (serverId: string) => {
    const server = servers.find((item) => item.id === serverId);
    openDeleteConfirm(
      [serverId],
      [server?.displayName || server?.name || serverId],
    );
  };
}

function createBatchTagSubmit(
  library: McpLibraryModel,
  bindings: McpManagerBindings,
  state: McpManagerState,
) {
  return async (tag: string, mode: McpBatchTagMode) => {
    const results = await Promise.allSettled(
      library.selectedServers.map((server) =>
        updateMcpServerTags(server, tag, mode, bindings.mcpStore.updateServer),
      ),
    );
    const { failedCount, updatedCount } = countBatchTagResults(results);
    showBatchTagResultToast(updatedCount, failedCount, mode, bindings);
    state.setSelectedServerIds(new Set());
  };
}

async function updateMcpServerTags(
  server: McpServerConfig,
  tag: string,
  mode: McpBatchTagMode,
  updateServer: McpManagerBindings["mcpStore"]["updateServer"],
) {
  const nextTags = updateMcpTags(server.tags, tag, mode);
  if (JSON.stringify(nextTags) === JSON.stringify(server.tags || []))
    return false;
  await updateServer(server.id, { tags: nextTags });
  return true;
}

function countBatchTagResults(results: PromiseSettledResult<boolean>[]) {
  return {
    updatedCount: results.filter(
      (result) => result.status === "fulfilled" && result.value,
    ).length,
    failedCount: results.filter((result) => result.status === "rejected")
      .length,
  };
}

function showBatchTagResultToast(
  updated: number,
  failed: number,
  mode: McpBatchTagMode,
  bindings: McpManagerBindings,
) {
  const { showToast, t } = bindings;
  const message =
    failed > 0
      ? t("mcp.batchTagPartialFailure", {
          updated,
          failed,
          defaultValue: `MCP tag update finished: ${updated} updated, ${failed} failed`,
        })
      : mode === "add"
        ? t("mcp.batchTagAddSuccess", {
            count: updated,
            defaultValue: `Added tag to ${updated} MCP server(s)`,
          })
        : t("mcp.batchTagRemoveSuccess", {
            count: updated,
            defaultValue: `Removed tag from ${updated} MCP server(s)`,
          });
  showToast(message, failed > 0 ? "error" : "success");
}

function createDeleteConfirm(
  bindings: McpManagerBindings,
  state: McpManagerState,
  reportError: McpErrorReporter,
) {
  return async () => {
    if (state.deleteConfirm.serverIds.length === 0 || state.isDeletingServers)
      return;
    state.setIsDeletingServers(true);
    try {
      for (const serverId of state.deleteConfirm.serverIds)
        await bindings.mcpStore.deleteServer(serverId);
      clearDeletedServerSelection(bindings, state);
      bindings.showToast(bindings.t("mcp.deleted", "MCP deleted"), "success");
    } catch (error) {
      reportError(error);
    } finally {
      state.setIsDeletingServers(false);
    }
  };
}

function clearDeletedServerSelection(
  bindings: McpManagerBindings,
  state: McpManagerState,
) {
  if (
    state.detailServerId &&
    state.deleteConfirm.serverIds.includes(state.detailServerId)
  ) {
    state.setDetailServerId(null);
    bindings.mcpStore.selectServer(null);
  }
  state.setSelectedServerIds(new Set());
  state.setIsSelectionMode(false);
  state.setDeleteConfirm({ isOpen: false, serverIds: [], serverNames: [] });
}

function createLibraryRefresh(
  bindings: McpManagerBindings,
  state: McpManagerState,
  reportError: McpErrorReporter,
) {
  return async () => {
    if (state.isRefreshingLibrary) return;
    state.setIsRefreshingLibrary(true);
    try {
      await bindings.mcpStore.load();
      bindings.showToast(
        bindings.t("mcp.refreshLibraryComplete", "MCP library refreshed"),
        "success",
      );
    } catch (error) {
      reportError(error);
    } finally {
      state.setIsRefreshingLibrary(false);
    }
  };
}

export function useMcpLibraryMutationActions(
  options: McpLibraryMutationActionOptions,
) {
  const { bindings, library, reportError, state } = options;
  const openDeleteConfirm = createDeleteConfirmOpen(state);
  return {
    handleToggleFavorite: createToggleFavorite(
      bindings.mcpStore.updateServer,
      reportError,
    ),
    handleBatchFavorite: createBatchFavorite(
      library,
      state,
      bindings.mcpStore.updateServer,
      reportError,
    ),
    handleBatchTags: createBatchTagDialogOpen(library, state),
    handleBatchDeploy: createBatchDeployDialogOpen(library, state),
    handleQuickDeploy: createQuickDeploy(state),
    closeDeployDialog: createCloseDeployDialog(state),
    openDeleteConfirm,
    closeDeleteConfirm: createDeleteConfirmClose(state),
    handleBatchDelete: createBatchDelete(library, openDeleteConfirm),
    handleDelete: createSingleDelete(library.servers, openDeleteConfirm),
    handleBatchTagSubmit: createBatchTagSubmit(library, bindings, state),
    confirmDelete: createDeleteConfirm(bindings, state, reportError),
    handleRefreshLibrary: createLibraryRefresh(bindings, state, reportError),
  };
}
