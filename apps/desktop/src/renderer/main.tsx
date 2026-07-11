import React from "react";
import ReactDOM from "react-dom/client";
import { ToastProvider } from "./components/ui/Toast";
import "./styles/globals.css";
import { i18nReady } from "./i18n";

// Start loading the app while the selected locale is initialized, without
// making the renderer entry parse every application feature before it can boot.
const appModule = import("./App");
const App = React.lazy(() => appModule);

const e2eBackupReady = window.electron?.e2e
  ? import("./services/database-backup").then(
      ({ exportDatabase, restoreFromBackup }) => {
        window.__PROMPTHUB_E2E_BACKUP__ = {
          exportDatabase,
          restoreFromBackup,
        };
      },
    )
  : Promise.resolve();

void Promise.all([i18nReady, e2eBackupReady]).then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ToastProvider>
        <React.Suspense
          fallback={<div className="h-screen bg-background" aria-busy="true" />}
        >
          <App />
        </React.Suspense>
      </ToastProvider>
    </React.StrictMode>,
  );
});
