import { Loader2Icon } from "lucide-react";

export function AgentProviderActivationSwitch({
  checked,
  disabled,
  loading,
  label,
  onActivate,
}: {
  checked: boolean;
  disabled: boolean;
  loading: boolean;
  label: string;
  onActivate: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || checked}
      onClick={onActivate}
      className={`relative h-6 w-10 shrink-0 rounded-full border shadow-inner transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-default ${
        checked
          ? "border-primary bg-primary"
          : "border-border bg-muted hover:border-primary/50 hover:bg-muted/80"
      } ${disabled && !checked ? "opacity-50" : ""}`}
    >
      <span
        data-testid="provider-activation-switch-thumb"
        className={`absolute left-0.5 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-black/5 bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      >
        {loading ? (
          <Loader2Icon className="h-3 w-3 animate-spin text-primary" />
        ) : null}
      </span>
    </button>
  );
}
