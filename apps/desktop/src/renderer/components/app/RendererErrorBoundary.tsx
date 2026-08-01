import React, { type ReactNode } from "react";
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

const RECOVERY_KEY = "prompthub.renderer-auto-reload";
const RECOVERY_COOLDOWN_MS = 10_000;

interface RendererErrorBoundaryProps {
  children: ReactNode;
  autoReload?: boolean;
  reload?: () => void;
}

interface RendererErrorBoundaryState {
  hasError: boolean;
}

function claimAutomaticReload(): boolean {
  try {
    const previous = Number(window.sessionStorage.getItem(RECOVERY_KEY) || 0);
    const now = Date.now();
    if (now - previous < RECOVERY_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RECOVERY_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

function RendererRecoveryScreen({ reload }: { reload: () => void }) {
  const { t } = useTranslation();

  return (
    <main
      role="alert"
      className="flex h-screen min-h-[420px] flex-col items-center justify-center bg-background px-8 text-center text-foreground"
    >
      <TriangleAlertIcon
        aria-hidden="true"
        className="h-9 w-9 text-destructive"
      />
      <h1 className="mt-5 text-xl font-semibold">
        {t(
          "common.rendererCrashedTitle",
          "PromptHub could not render this page",
        )}
      </h1>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        {t(
          "common.rendererCrashedDescription",
          "The local data is unchanged. Reload PromptHub to restore the interface.",
        )}
      </p>
      <button
        type="button"
        onClick={reload}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        <RefreshCwIcon aria-hidden="true" className="h-4 w-4" />
        {t("common.reloadPromptHub", "Reload PromptHub")}
      </button>
    </main>
  );
}

export class RendererErrorBoundary extends React.Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  state: RendererErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RendererErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Renderer failed:", error);
    if (
      import.meta.env.DEV &&
      this.props.autoReload !== false &&
      claimAutomaticReload()
    ) {
      window.setTimeout(this.reload, 100);
    }
  }

  private reload = () => {
    (this.props.reload ?? (() => window.location.reload()))();
  };

  render() {
    return this.state.hasError ? (
      <RendererRecoveryScreen reload={this.reload} />
    ) : (
      this.props.children
    );
  }
}
