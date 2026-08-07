import React from "react";
import ReactDOM from "react-dom/client";
import { AgentUsagePopover } from "./components/agent/AgentUsagePopover";
import { RendererErrorBoundary } from "./components/app/RendererErrorBoundary";
import { ToastProvider } from "./components/ui/Toast";
import "./styles/globals.css";
import { i18nReady } from "./i18n";

const surface = new URLSearchParams(window.location.search).get("surface");
const isAgentUsagePopover = surface === "agent-usage";
document.documentElement.dataset.surface = surface ?? "app";
const App = React.lazy(() => import("./App"));
const root = ReactDOM.createRoot(document.getElementById("root")!);

const e2eBackupReady =
  !isAgentUsagePopover && window.electron?.e2e
    ? import("./services/database-backup").then(
        ({ exportDatabase, restoreFromBackup }) => {
          window.__PROMPTHUB_E2E_BACKUP__ = {
            exportDatabase,
            restoreFromBackup,
          };
        },
      )
    : Promise.resolve();

function renderRenderer(children: React.ReactNode) {
  root.render(
    <React.StrictMode>
      <RendererErrorBoundary>{children}</RendererErrorBoundary>
    </React.StrictMode>,
  );
}

function RendererBootstrapFailure({ error }: { error: unknown }): never {
  throw error instanceof Error ? error : new Error(String(error));
}

void Promise.all([i18nReady, e2eBackupReady])
  .then(() => {
    if (isAgentUsagePopover) {
      renderRenderer(<AgentUsagePopover />);
      return;
    }
    renderRenderer(
      <ToastProvider>
        <React.Suspense
          fallback={<div className="h-screen bg-background" aria-busy="true" />}
        >
          <App />
        </React.Suspense>
      </ToastProvider>,
    );
  })
  .catch((error: unknown) => {
    renderRenderer(<RendererBootstrapFailure error={error} />);
  });
