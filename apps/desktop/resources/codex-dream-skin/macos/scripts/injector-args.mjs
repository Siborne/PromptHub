import path from "node:path";
import {
  OPERATION_KINDS,
  OPERATION_UI_STATES,
} from "./injector-operation-ui.mjs";

export function parseArgs(argv) {
  const options = {
    port: 9341,
    mode: "watch",
    timeoutMs: 30000,
    screenshot: null,
    reload: false,
    themeDir: null,
    operationState: null,
    operationAck: null,
    operationKind: null,
    operationUiState: null,
    operationMessage: null,
    operationToken: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port") options.port = Number(argv[++i]);
    else if (arg === "--once") options.mode = "once";
    else if (arg === "--watch") options.mode = "watch";
    else if (arg === "--verify") options.mode = "verify";
    else if (arg === "--remove") options.mode = "remove";
    else if (arg === "--begin-operation") options.mode = "begin-operation";
    else if (arg === "--finish-operation") options.mode = "finish-operation";
    else if (arg === "--check-payload") options.mode = "check";
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++i]);
    else if (arg === "--screenshot")
      options.screenshot = path.resolve(argv[++i]);
    else if (arg === "--theme-dir") options.themeDir = path.resolve(argv[++i]);
    else if (arg === "--operation-state")
      options.operationState = path.resolve(argv[++i]);
    else if (arg === "--operation-ack")
      options.operationAck = path.resolve(argv[++i]);
    else if (arg === "--operation-kind") options.operationKind = argv[++i];
    else if (arg === "--operation-ui-state")
      options.operationUiState = argv[++i];
    else if (arg === "--operation-message")
      options.operationMessage = argv[++i];
    else if (arg === "--operation-token") options.operationToken = argv[++i];
    else if (arg === "--reload") options.reload = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (
    !Number.isInteger(options.port) ||
    options.port < 1024 ||
    options.port > 65535
  ) {
    throw new Error(`Invalid port: ${options.port}`);
  }
  if (
    !Number.isFinite(options.timeoutMs) ||
    options.timeoutMs < 250 ||
    options.timeoutMs > 120000
  ) {
    throw new Error(`Invalid timeout: ${options.timeoutMs}`);
  }
  if (
    options.operationToken !== null &&
    !/^\d{1,12}:\d{13}:\d{1,8}$/.test(options.operationToken)
  ) {
    throw new Error("Invalid operation token");
  }
  if (
    options.mode === "begin-operation" &&
    !OPERATION_KINDS.has(options.operationKind)
  ) {
    throw new Error(
      "Begin operation requires --operation-kind apply, pause, or switch",
    );
  }
  if (options.mode === "finish-operation") {
    if (!OPERATION_UI_STATES.has(options.operationUiState)) {
      throw new Error(
        "Finish operation requires --operation-ui-state success, error, or cancelled",
      );
    }
    if (!options.operationToken)
      throw new Error("Finish operation requires --operation-token");
    if (
      typeof options.operationMessage !== "string" ||
      options.operationMessage.length > 240 ||
      /[\r\n]/.test(options.operationMessage)
    ) {
      throw new Error(
        "Finish operation requires a single-line --operation-message up to 240 characters",
      );
    }
  }
  return options;
}
