import type { ReactNode } from "react";

export function providerWorkbenchListItemClass(
  selected: boolean,
  className = "",
): string {
  const state = selected
    ? "border-primary/30 bg-card shadow-sm ring-1 ring-primary/10"
    : "border-border/70 bg-card hover:border-primary/20 hover:shadow-sm";
  return `block w-full rounded-lg border text-left transition-all ${state} ${className}`.trim();
}

export function AgentProviderWorkbenchLayout({
  toolbar,
  sidebar,
  footer,
  children,
}: {
  toolbar: ReactNode;
  sidebar: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-testid="agent-provider-workbench" className="flex min-h-0 flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/20 sm:w-64 xl:w-72">
        <div
          data-testid="agent-provider-workbench-toolbar"
          className="border-b border-border p-3"
        >
          <div className="flex h-8 items-center justify-end gap-2">
            {toolbar}
          </div>
        </div>
        <div
          data-testid="agent-provider-workbench-sidebar"
          className="min-h-0 flex-1 overflow-hidden"
        >
          {sidebar}
        </div>
        <div className="border-t border-border p-3">{footer}</div>
      </aside>
      <section
        data-testid="agent-provider-workbench-detail"
        className="flex min-w-0 flex-1 flex-col"
      >
        {children}
      </section>
    </div>
  );
}

export function AgentProviderDetailSurface({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/[0.12] px-5 py-5">
      {children}
    </div>
  );
}

export function AgentProviderDetailSection({
  children,
  className = "",
  ariaLabelledBy,
}: {
  children: ReactNode;
  className?: string;
  ariaLabelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={ariaLabelledBy}
      className={`overflow-hidden rounded-lg border border-border bg-card shadow-sm ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export function AgentProviderDetailHeader({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <header className="flex min-w-0 flex-wrap items-center gap-2 px-4 py-4">
      {children}
    </header>
  );
}

export function AgentProviderDetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-border/60 py-3 last:border-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-sm text-foreground">{children}</dd>
    </div>
  );
}
