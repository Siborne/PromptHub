import type { Rectangle } from "electron";

export const AGENT_USAGE_POPOVER_SIZE = { width: 392, height: 540 } as const;
const EDGE_MARGIN = 8;

interface PopoverWindow {
  close(): void;
  focus(): void;
  hide(): void;
  isDestroyed(): boolean;
  on(event: "blur" | "closed", listener: () => void): unknown;
  setBounds(bounds: Rectangle): void;
  show(): void;
}

interface AgentUsagePopoverControllerOptions {
  createWindow: () => PopoverWindow;
  getWorkArea: (anchor: Rectangle) => Rectangle;
  loadWindow: (window: PopoverWindow) => Promise<void>;
  onLoadError: () => void;
}

export interface AgentUsagePopoverController {
  destroy(): void;
  show(anchor: Rectangle | null): Promise<void>;
}

export function calculateAgentUsagePopoverBounds(input: {
  anchor: Rectangle;
  size: { width: number; height: number };
  workArea: Rectangle;
}): Rectangle {
  const { anchor, size, workArea } = input;
  const minX = workArea.x + EDGE_MARGIN;
  const maxX = workArea.x + workArea.width - size.width - EDGE_MARGIN;
  const x = Math.min(
    Math.max(anchor.x + anchor.width / 2 - size.width / 2, minX),
    Math.max(minX, maxX),
  );
  const opensBelow =
    anchor.y + anchor.height / 2 < workArea.y + workArea.height / 2;
  const desiredY = opensBelow
    ? anchor.y + anchor.height + EDGE_MARGIN
    : anchor.y - size.height - EDGE_MARGIN;
  const minY = workArea.y + EDGE_MARGIN;
  const maxY = workArea.y + workArea.height - size.height - EDGE_MARGIN;
  return {
    x: Math.round(x),
    y: Math.round(Math.min(Math.max(desiredY, minY), Math.max(minY, maxY))),
    width: size.width,
    height: size.height,
  };
}

export function createAgentUsagePopoverController(
  options: AgentUsagePopoverControllerOptions,
): AgentUsagePopoverController {
  let window: PopoverWindow | null = null;
  let opening: Promise<void> | null = null;
  let generation = 0;

  const show = (anchor: Rectangle | null): Promise<void> => {
    if (!anchor) return Promise.resolve();
    if (opening) return opening;
    const bounds = calculateAgentUsagePopoverBounds({
      anchor,
      size: AGENT_USAGE_POPOVER_SIZE,
      workArea: options.getWorkArea(anchor),
    });
    if (window && !window.isDestroyed()) {
      window.setBounds(bounds);
      window.show();
      window.focus();
      return Promise.resolve();
    }

    const currentGeneration = ++generation;
    const nextWindow = options.createWindow();
    window = nextWindow;
    nextWindow.setBounds(bounds);
    nextWindow.on("blur", () => nextWindow.hide());
    nextWindow.on("closed", () => {
      if (window === nextWindow) window = null;
      if (window === null) opening = null;
    });
    opening = options
      .loadWindow(nextWindow)
      .then(() => {
        if (
          generation !== currentGeneration ||
          window !== nextWindow ||
          nextWindow.isDestroyed()
        ) {
          return;
        }
        nextWindow.show();
        nextWindow.focus();
      })
      .catch(() => {
        if (generation !== currentGeneration || window !== nextWindow) return;
        options.onLoadError();
        window = null;
        if (!nextWindow.isDestroyed()) nextWindow.close();
      });
    return opening.finally(() => {
      if (generation === currentGeneration) opening = null;
    });
  };

  return {
    destroy() {
      generation += 1;
      opening = null;
      const current = window;
      window = null;
      if (current && !current.isDestroyed()) current.close();
    },
    show,
  };
}
