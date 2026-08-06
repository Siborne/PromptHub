import { describe, expect, it } from "vitest";
import type { McpServerConfig } from "@prompthub/shared/types/mcp";
import {
  formToDraft,
  serverToForm,
} from "../../../src/renderer/components/mcp/mcp-form-utils";

describe("mcp form utils", () => {
  it("keeps direct values and references in separate editable fields", () => {
    const server: McpServerConfig = {
      id: "mcp_private",
      name: "private-api",
      displayName: "Private API",
      transport: "streamable-http",
      url: "https://example.com/mcp",
      headers: { Authorization: "[REDACTED]" },
      headerRefs: { "X-Workspace": "${WORKSPACE_ID}" },
      env: { API_TOKEN: "[REDACTED]" },
      envRefs: { API_REGION: "${REGION:-local}" },
      enabled: true,
      source: { type: "manual" },
      createdAt: 1,
      updatedAt: 1,
    };

    const form = serverToForm(server);
    expect(form.env).toBe("API_TOKEN=[REDACTED]");
    expect(form.envRefs).toBe("API_REGION=${REGION:-local}");
    expect(form.headers).toBe("Authorization=[REDACTED]");
    expect(form.headerRefs).toBe("X-Workspace=${WORKSPACE_ID}");

    expect(formToDraft(form)).toMatchObject({
      env: { API_TOKEN: "[REDACTED]" },
      envRefs: { API_REGION: "${REGION:-local}" },
      headers: { Authorization: "[REDACTED]" },
      headerRefs: { "X-Workspace": "${WORKSPACE_ID}" },
    });
  });
});
