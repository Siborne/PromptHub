import type { ReactNode } from "react";

export function DataSettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="px-1 text-[15px] font-semibold tracking-tight text-foreground/80">
        {title}
      </h3>
      <div className="app-settings-card overflow-hidden">{children}</div>
    </section>
  );
}

export function getSyncPanelContentClassName(disabled: boolean): string {
  return disabled
    ? "space-y-3 pt-2 border-t border-border opacity-60"
    : "space-y-3 pt-2 border-t border-border";
}
