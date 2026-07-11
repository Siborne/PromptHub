const SKILL_VIEW_TRANSITION_CLASS =
  "h-full min-h-0 animate-in fade-in slide-in-from-right-3 duration-smooth";

interface SkillViewTransitionProps extends React.HTMLAttributes<HTMLDivElement> {
  viewKey: string;
}

export function SkillViewTransition({
  viewKey,
  className = "",
  children,
  ...props
}: SkillViewTransitionProps) {
  return (
    <div
      key={viewKey}
      data-testid="skill-view-transition"
      data-skill-view={viewKey}
      className={`${SKILL_VIEW_TRANSITION_CLASS} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
