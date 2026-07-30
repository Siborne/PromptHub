import { useId, useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentProviderProfilePublic,
  UpdateAgentProviderProfileRequest,
} from "@prompthub/shared/types";

export type AgentProviderCredentialAction =
  UpdateAgentProviderProfileRequest["secretAction"];

interface AgentProviderCredentialFieldProps {
  profileSecretState: AgentProviderProfilePublic["secretState"] | null;
  action: AgentProviderCredentialAction;
  value: string;
  disabled: boolean;
  error?: string;
  onActionChange: (action: AgentProviderCredentialAction) => void;
  onValueChange: (value: string) => void;
}

const ACTIONS: AgentProviderCredentialAction[] = [
  "preserve",
  "replace",
  "clear",
];

export function AgentProviderCredentialField({
  profileSecretState,
  action,
  value,
  disabled,
  error,
  onActionChange,
  onValueChange,
}: AgentProviderCredentialFieldProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const errorId = error ? `${inputId}-error` : undefined;
  const [revealed, setRevealed] = useState(false);
  const editing = profileSecretState !== null;
  const acceptsInput = !editing || action === "replace";

  function selectAction(nextAction: AgentProviderCredentialAction): void {
    onActionChange(nextAction);
    if (nextAction !== "replace") {
      onValueChange("");
      setRevealed(false);
    }
  }

  return (
    <div className="mt-5 border-t border-border/60 pt-5">
      {editing ? (
        <div
          role="radiogroup"
          aria-label={t("agents.providerProfiles.form.credentialAction")}
          className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1"
        >
          {ACTIONS.map((candidate) => {
            const selected = action === candidate;
            return (
              <button
                key={candidate}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => selectAction(candidate)}
                className={`min-h-9 rounded-md px-2 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(
                  `agents.providerProfiles.form.credentialActionOptions.${candidate}`,
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      {acceptsInput ? (
        <div className="space-y-1.5">
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {t("agents.providerProfiles.form.credential")}
          </label>
          <div className="relative">
            <input
              id={inputId}
              type={revealed ? "text" : "password"}
              autoComplete="off"
              aria-describedby={errorId}
              aria-invalid={Boolean(error)}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              disabled={disabled}
              placeholder={t(
                editing
                  ? "agents.providerProfiles.form.credentialReplacement"
                  : "agents.providerProfiles.form.credentialOptional",
              )}
              className={`h-10 w-full rounded-xl border-0 bg-muted/50 px-4 pr-11 text-sm placeholder:text-muted-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                error ? "ring-2 ring-destructive/50" : ""
              }`}
            />
            {value ? (
              <button
                type="button"
                aria-label={t(
                  revealed
                    ? "agents.providerProfiles.form.hideCredential"
                    : "agents.providerProfiles.form.showCredential",
                )}
                aria-pressed={revealed}
                onClick={() => setRevealed((current) => !current)}
                disabled={disabled}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {revealed ? (
                  <EyeOffIcon aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <EyeIcon aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
            ) : null}
          </div>
          {error ? (
            <p id={errorId} className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        {t("agents.providerProfiles.form.credentialHint")}
      </p>
    </div>
  );
}
