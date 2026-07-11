import { useMcpErrorReporter } from "./mcp-manager-action-utils";
import { useMcpLibraryMutationActions } from "./useMcpLibraryMutationActions";
import { useMcpLibraryModel } from "./useMcpLibraryModel";
import { useMcpLibrarySelectionActions } from "./useMcpLibrarySelectionActions";
import { useMcpManagerBindings } from "./useMcpManagerBindings";
import { useMcpManagerLifecycle } from "./useMcpManagerLifecycle";
import { useMcpManagerState } from "./useMcpManagerState";
import { useMcpManagerTargets } from "./useMcpManagerTargets";
import { useMcpSourceActions } from "./useMcpSourceActions";
import { useMcpTargetActions } from "./useMcpTargetActions";

function useMcpManagerActions(
  bindings: ReturnType<typeof useMcpManagerBindings>,
  state: ReturnType<typeof useMcpManagerState>,
  targets: ReturnType<typeof useMcpManagerTargets>,
  library: ReturnType<typeof useMcpLibraryModel>,
) {
  const reportError = useMcpErrorReporter(bindings.showToast);
  const selection = useMcpLibrarySelectionActions({ bindings, library, state });
  const source = useMcpSourceActions({ bindings, library, reportError, state });
  const target = useMcpTargetActions({
    bindings,
    openServerDetail: selection.openServerDetail,
    reportError,
    state,
    targets,
  });
  const mutation = useMcpLibraryMutationActions({
    bindings,
    library,
    reportError,
    state,
  });
  return { ...selection, ...source, ...target, ...mutation };
}

/** Composes MCP page state, derived presentation data, actions, and effects. */
export function useMcpManagerController() {
  const bindings = useMcpManagerBindings();
  const state = useMcpManagerState();
  const targets = useMcpManagerTargets(bindings);
  const library = useMcpLibraryModel({ bindings, state, targets });
  const actions = useMcpManagerActions(bindings, state, targets, library);
  useMcpManagerLifecycle({ bindings, library, state, targets });
  return {
    ...bindings.mcpStore,
    ...bindings,
    ...state,
    ...targets,
    ...library,
    ...actions,
  };
}

export type McpManagerViewModel = ReturnType<typeof useMcpManagerController>;
