import { describe, expect, it, vi } from "vitest";

import {
  APP_ASSET_WORKFLOW_READY_EVENT,
  registerAssetWorkflowEvent,
} from "../../../src/renderer/components/app/app-command-events";

describe("registerAssetWorkflowEvent", () => {
  it.each(["mcp", "plugin"] as const)(
    "registers the %s workflow before announcing readiness and cleans it up",
    (asset) => {
      const workflowEvent = `test:${asset}:workflow`;
      const onWorkflow = vi.fn();
      const readinessListener = vi.fn((event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail.asset === asset && detail.ready) {
          document.dispatchEvent(new CustomEvent(workflowEvent));
        }
      });
      document.addEventListener(
        APP_ASSET_WORKFLOW_READY_EVENT,
        readinessListener,
      );

      const unregister = registerAssetWorkflowEvent({
        asset,
        eventName: workflowEvent,
        listener: onWorkflow,
      });

      expect(onWorkflow).toHaveBeenCalledTimes(1);
      expect(
        (readinessListener.mock.calls[0]?.[0] as CustomEvent).detail,
      ).toEqual({
        asset,
        ready: true,
      });

      unregister();
      document.dispatchEvent(new CustomEvent(workflowEvent));
      expect(onWorkflow).toHaveBeenCalledTimes(1);
      expect(
        (readinessListener.mock.calls[1]?.[0] as CustomEvent).detail,
      ).toEqual({
        asset,
        ready: false,
      });
      document.removeEventListener(
        APP_ASSET_WORKFLOW_READY_EVENT,
        readinessListener,
      );
    },
  );
});
