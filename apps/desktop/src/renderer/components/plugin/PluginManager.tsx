import { PluginManagerView } from "./PluginManagerView";
import { usePluginManagerController } from "./usePluginManagerController";

export function PluginManager() {
  const model = usePluginManagerController();
  return <PluginManagerView model={model} />;
}
