import { PluginFullDetailView } from "./PluginFullDetailView";
import {
  type PluginFullDetailPageProps,
  usePluginFullDetailController,
} from "./usePluginFullDetailController";

export function PluginFullDetailPage(props: PluginFullDetailPageProps) {
  const model = usePluginFullDetailController(props);
  return <PluginFullDetailView model={model} />;
}
