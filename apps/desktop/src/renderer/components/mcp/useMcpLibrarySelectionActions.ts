import type { McpServerConfig } from "@prompthub/shared/types/mcp";
import type { McpLibraryModel } from "./useMcpLibraryModel";
import type { McpManagerState } from "./useMcpManagerState";
import type { McpManagerBindings } from "./useMcpManagerBindings";
import {
  ALL_MCP_SOURCE_FILTER,
  type McpLibraryFilter,
} from "./mcp-manager-utils";

interface McpLibrarySelectionActionOptions {
  bindings: McpManagerBindings;
  library: McpLibraryModel;
  state: McpManagerState;
}

function createOpenServerDetail(
  state: McpManagerState,
  bindings: McpManagerBindings,
) {
  return (server: McpServerConfig) => {
    state.setLibraryFilter("all");
    state.setSourceFilterKey(ALL_MCP_SOURCE_FILTER);
    bindings.mcpStore.setSearchQuery("");
    bindings.mcpStore.selectServer(server.id);
    state.setDetailServerId(server.id);
    bindings.mcpStore.setSelectedTab("library");
  };
}

function createLibraryFilterChange(
  state: McpManagerState,
  bindings: McpManagerBindings,
) {
  return (nextFilter: McpLibraryFilter) => {
    state.setLibraryFilter(nextFilter);
    state.setDetailServerId(null);
    bindings.mcpStore.selectServer(null);
  };
}

function createSelectionModeToggle(state: McpManagerState) {
  return () => {
    state.setIsSelectionMode((current) => !current);
    state.setSelectedServerIds((current) =>
      current.size === 0 ? current : new Set(),
    );
  };
}

function createServerSelectionToggle(state: McpManagerState) {
  return (serverId: string) => {
    state.setSelectedServerIds((current) => {
      const next = new Set(current);
      next.has(serverId) ? next.delete(serverId) : next.add(serverId);
      return next;
    });
  };
}

function createVisibleSelectionToggle(
  allVisibleSelected: boolean,
  visibleServers: McpServerConfig[],
  state: McpManagerState,
) {
  return () => {
    if (allVisibleSelected) {
      state.setSelectedServerIds(new Set());
      return;
    }
    state.setSelectedServerIds(
      (current) =>
        new Set([...current, ...visibleServers.map((server) => server.id)]),
    );
  };
}

function createPageChange(totalPages: number, state: McpManagerState) {
  return (page: number) => {
    state.setCurrentPage(Math.min(Math.max(page, 1), totalPages));
  };
}

function createServerSelect(
  state: McpManagerState,
  bindings: McpManagerBindings,
) {
  return (serverId: string) => {
    bindings.mcpStore.selectServer(serverId);
    state.setDetailServerId(serverId);
  };
}

function createPageSizeChange(state: McpManagerState) {
  return (nextPageSize: number) => {
    state.setPageSize(nextPageSize);
    state.setCurrentPage(1);
  };
}

export function useMcpLibrarySelectionActions(
  options: McpLibrarySelectionActionOptions,
) {
  const { bindings, library, state } = options;
  return {
    openServerDetail: createOpenServerDetail(state, bindings),
    handleLibraryFilterChange: createLibraryFilterChange(state, bindings),
    toggleSelectionMode: createSelectionModeToggle(state),
    toggleServerSelection: createServerSelectionToggle(state),
    handleSelectAllVisible: createVisibleSelectionToggle(
      library.allVisibleSelected,
      library.visibleServers,
      state,
    ),
    goToPage: createPageChange(library.totalPages, state),
    handleSelectServer: createServerSelect(state, bindings),
    handleChangePageSize: createPageSizeChange(state),
  };
}
