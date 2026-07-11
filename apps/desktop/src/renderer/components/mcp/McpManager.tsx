import { Spinner } from "../ui/Spinner";
import { McpManagerDialogLayer } from "./McpManagerDialogLayer";
import { McpManagerViewRouter } from "./McpManagerViewRouter";
import { useMcpManagerController } from "./useMcpManagerController";

/**
 * MCP page composition root. State, derived data, lifecycle effects, and
 * side-effect actions are owned by the controller's focused hooks.
 */
export function McpManager() {
  const model = useMcpManagerController();
  if (model.isLoading && !model.library) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <McpManagerViewRouter model={model} />
      <McpManagerDialogLayer model={model} />
    </div>
  );
}

export default McpManager;
