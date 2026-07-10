import type { Readable } from "stream";

import { CoreMcpError } from "../mcp-library";
import {
  CliError,
  EXIT_CODES,
  type CliContext,
  type OutputFormat,
} from "./types";

export function suppressConsoleNoise(): () => void {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  console.log = () => undefined;
  console.info = () => undefined;
  console.warn = () => undefined;
  return () => {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
  };
}
export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
export function cloneArgs(argv: string[]): string[] {
  return [...argv];
}

export function formatCell(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  return String(value);
}

export function renderTable(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) {
    return "(empty)";
  }

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  // Pre-compute all formatted cells once (avoids double formatCell calls)
  const formattedCells = rows.map((row) =>
    columns.map((column) => formatCell(row[column])),
  );

  const widths = columns.map((column, colIndex) => {
    let max = column.length;
    for (const rowCells of formattedCells) {
      const len = rowCells[colIndex].length;
      if (len > max) max = len;
    }
    return max;
  });

  const renderLine = (cells: string[]) =>
    cells
      .map((cell, index) => cell.padEnd(widths[index], " "))
      .join("  ")
      .trimEnd();

  const header = renderLine(columns);
  const separator = widths.map((width) => "-".repeat(width)).join("  ");
  const body = formattedCells.map((rowCells) => renderLine(rowCells));

  return [header, separator, ...body].join("\n");
}

export function emitSuccess(
  context: CliContext,
  payload: unknown,
  tableRows?: Array<Record<string, unknown>>,
): void {
  if (context.output === "table") {
    if (tableRows) {
      context.io.stdout(renderTable(tableRows));
      return;
    }
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      context.io.stdout(
        renderTable(
          Object.entries(payload as Record<string, unknown>).map(
            ([key, value]) => ({
              field: key,
              value,
            }),
          ),
        ),
      );
      return;
    }
  }

  context.io.stdout(toJson(payload));
}

export function emitError(context: CliContext, error: CliError): void {
  if (context.output === "json") {
    context.io.stderr(
      toJson({
        error: {
          code: error.code,
          message: error.message,
          exitCode: error.exitCode,
          details: error.details,
        },
      }),
    );
    return;
  }

  const detailText = error.details ? ` details=${toJson(error.details)}` : "";
  context.io.stderr(
    `[${error.code}] exit=${error.exitCode} ${error.message}${detailText}`,
  );
}

export function mapCoreMcpError(error: CoreMcpError): CliError {
  const exitCode =
    error.code === "TARGET_CONFLICT"
      ? EXIT_CODES.CONFLICT
      : error.code === "NOT_FOUND"
        ? EXIT_CODES.NOT_FOUND
        : EXIT_CODES.USAGE;
  return new CliError(error.code, error.message, exitCode);
}
