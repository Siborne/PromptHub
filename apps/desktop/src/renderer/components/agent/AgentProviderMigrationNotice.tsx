import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  KeyRoundIcon,
  Loader2Icon,
  ShieldCheckIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentProviderMigrationCandidate,
  AgentProviderMigrationPreview,
} from "@prompthub/shared";

import { Button, Modal } from "../ui";

function credentialLabel(
  candidate: AgentProviderMigrationCandidate,
  t: (key: string) => string,
): string {
  return t(`agents.providerMigration.source.${candidate.credentialSource}`);
}

export function AgentProviderMigrationNotice({
  onMigrated,
}: {
  onMigrated?: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<AgentProviderMigrationPreview | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await window.api.agent.previewProviderMigration("codex");
      setPreview(next);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(
    () =>
      preview?.candidates.filter((candidate) => !candidate.alreadyMigrated) ??
      [],
    [preview],
  );

  function toggle(providerId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
  }

  async function migrate() {
    if (!preview || selectedIds.size === 0) return;
    setBusy(true);
    setError(false);
    try {
      await window.api.agent.migrateProviderProfiles({
        agentId: "codex",
        expectedNativeDigest: preview.nativeDigest,
        providerIds: [...selectedIds],
      });
      setSelectedIds(new Set());
      await load();
      setOpen(false);
      await onMigrated?.();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!preview || pending.length === 0 || dismissed) return null;

  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-primary/20 bg-primary/[0.05] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <ShieldCheckIcon className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t("agents.providerMigration.noticeTitle", {
                count: pending.length,
              })}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {t("agents.providerMigration.noticeHint")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t("agents.providerMigration.later")}
          </button>
          <Button size="sm" onClick={() => setOpen(true)}>
            {t("agents.providerMigration.review")}
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Modal
        isOpen={open}
        onClose={() => !busy && setOpen(false)}
        title={t("agents.providerMigration.title")}
        subtitle={t("agents.providerMigration.subtitle")}
        size="lg"
        closeOnBackdrop={!busy}
        closeOnEscape={!busy}
      >
        <div className="space-y-2" role="group">
          {pending.map((candidate) => (
            <label
              key={candidate.providerId}
              className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-3 hover:bg-accent/40"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(candidate.providerId)}
                onChange={() => toggle(candidate.providerId)}
                disabled={busy}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <KeyRoundIcon
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {candidate.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {credentialLabel(candidate, t)}
                  {candidate.profileModel ? ` · ${candidate.profileModel}` : ""}
                </span>
              </span>
              {candidate.credentialReady ? (
                <CheckCircle2Icon
                  className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-label={t("agents.providerMigration.credentialReady")}
                />
              ) : null}
            </label>
          ))}
        </div>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          {t("agents.providerMigration.consentHint")}
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {t("agents.providerMigration.error")}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            {t("agents.providerMigration.later")}
          </Button>
          <Button
            onClick={() => void migrate()}
            disabled={busy || selectedIds.size === 0}
          >
            {busy ? (
              <Loader2Icon
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {t("agents.providerMigration.migrateSelected", {
              count: selectedIds.size,
            })}
          </Button>
        </div>
      </Modal>
    </>
  );
}
