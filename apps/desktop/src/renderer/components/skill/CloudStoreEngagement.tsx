import { useEffect, useState } from "react";
import { FlagIcon, HeartIcon, Loader2Icon, StarIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  CloudStoreListingDetails,
  CloudStoreMetrics,
  CloudStoreReportReason,
} from "@prompthub/shared/types";
import { useToast } from "../ui/Toast";

interface CloudStoreEngagementProps {
  slug: string;
}

const REPORT_REASONS: CloudStoreReportReason[] = [
  "security",
  "copyright",
  "misleading",
  "spam",
  "other",
];

export function CloudStoreEngagement({ slug }: CloudStoreEngagementProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [details, setDetails] = useState<CloudStoreListingDetails | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<"like" | "favorite" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<CloudStoreReportReason>("security");
  const [reportDetails, setReportDetails] = useState("");
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      window.api.cloud.store.getListing(slug),
      window.api.cloud.auth.getState().catch(() => null),
    ])
      .then(([nextDetails, authState]) => {
        if (cancelled) return;
        setDetails(nextDetails as CloudStoreListingDetails);
        setAuthenticated(authState?.authenticated === true);
      })
      .catch(() => {
        if (!cancelled) setDetails(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const updateInteraction = async (interaction: "like" | "favorite") => {
    if (!details || pendingAction) return;
    if (!authenticated) {
      showToast(t("cloudStore.loginRequired", "Sign in to interact with the Store"), "info");
      return;
    }
    const active = interaction === "like" ? details.viewerState.liked : details.viewerState.favorited;
    setPendingAction(interaction);
    try {
      const metrics = active
        ? interaction === "like"
          ? await window.api.cloud.store.unlike(details.listing.id)
          : await window.api.cloud.store.unfavorite(details.listing.id)
        : interaction === "like"
          ? await window.api.cloud.store.like(details.listing.id)
          : await window.api.cloud.store.favorite(details.listing.id);
      setDetails((current) => (current ? applyInteraction(current, metrics, interaction, !active) : current));
    } catch {
      showToast(t("cloudStore.interactionFailed", "Could not update this Store action"), "error");
    } finally {
      setPendingAction(null);
    }
  };

  const submitReport = async () => {
    if (!details || isReporting) return;
    if (!authenticated) {
      showToast(t("cloudStore.loginRequired", "Sign in to interact with the Store"), "info");
      return;
    }
    setIsReporting(true);
    try {
      await window.api.cloud.store.report(details.listing.id, {
        reason: reportReason,
        ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}),
      });
      setReportOpen(false);
      setReportDetails("");
      showToast(t("cloudStore.reportSubmitted", "Report submitted"), "success");
    } catch {
      showToast(t("cloudStore.reportFailed", "Could not submit the report"), "error");
    } finally {
      setIsReporting(false);
    }
  };

  if (loading || !details) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1.5">
        <EngagementButton
          active={details.viewerState.liked}
          count={details.metrics.likeCount}
          disabled={pendingAction !== null}
          label={t("cloudStore.like", "Like")}
          pending={pendingAction === "like"}
          onClick={() => void updateInteraction("like")}
          icon={<HeartIcon aria-hidden="true" className="h-3.5 w-3.5" />}
        />
        <EngagementButton
          active={details.viewerState.favorited}
          count={details.metrics.favoriteCount}
          disabled={pendingAction !== null}
          label={t("cloudStore.favorite", "Favorite")}
          pending={pendingAction === "favorite"}
          onClick={() => void updateInteraction("favorite")}
          icon={<StarIcon aria-hidden="true" className="h-3.5 w-3.5" />}
        />
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          onClick={() => {
            if (!authenticated) {
              showToast(t("cloudStore.loginRequired", "Sign in to interact with the Store"), "info");
              return;
            }
            setReportOpen((open) => !open);
          }}
          aria-expanded={reportOpen}
          title={t("cloudStore.report", "Report")}
        >
          <FlagIcon aria-hidden="true" className="h-3.5 w-3.5" />
          {t("cloudStore.report", "Report")}
        </button>
      </div>
      {reportOpen && (
        <div className="mt-2 rounded-xl border border-border bg-accent/20 p-2.5">
          <div className="flex items-center gap-2">
            <label htmlFor={`cloud-report-reason-${slug}`} className="sr-only">
              {t("cloudStore.reportReason", "Report reason")}
            </label>
            <select
              id={`cloud-report-reason-${slug}`}
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value as CloudStoreReportReason)}
              className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
            >
              {REPORT_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {t(`cloudStore.reportReasons.${reason}`, reason)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void submitReport()}
              disabled={isReporting}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {isReporting && <Loader2Icon aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />}
              {t("cloudStore.submitReport", "Submit")}
            </button>
          </div>
          <label htmlFor={`cloud-report-details-${slug}`} className="sr-only">
            {t("cloudStore.reportDetails", "Additional details")}
          </label>
          <textarea
            id={`cloud-report-details-${slug}`}
            value={reportDetails}
            onChange={(event) => setReportDetails(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder={t("cloudStore.reportDetailsPlaceholder", "Optional details")}
            className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/50"
          />
        </div>
      )}
    </div>
  );
}

function EngagementButton({
  active,
  count,
  disabled,
  icon,
  label,
  onClick,
  pending,
}: {
  active: boolean;
  count: number;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  pending: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${label} ${count}`}
      title={label}
      className={`inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] transition-colors disabled:opacity-50 ${
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      {pending ? <Loader2Icon aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : icon}
      {count}
    </button>
  );
}

function applyInteraction(
  current: CloudStoreListingDetails,
  metrics: CloudStoreMetrics,
  interaction: "like" | "favorite",
  active: boolean,
): CloudStoreListingDetails {
  return {
    ...current,
    metrics,
    viewerState: {
      ...current.viewerState,
      ...(interaction === "like" ? { liked: active } : { favorited: active }),
    },
  };
}
