import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";

const IDLE_FRAME_DURATIONS = [280, 110, 110, 140, 140, 320] as const;

interface AgentAppearancePreviewProps {
  agentId: string;
  assetId: string;
  kind: "theme" | "pet";
  alt: string;
  spriteVersionNumber?: 1 | 2;
}

function usePrefersReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reducedMotion;
}

function AgentPetAnimationPreview({
  src,
  alt,
  spriteVersionNumber,
}: {
  src: string;
  alt: string;
  spriteVersionNumber: 1 | 2;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      setFrame(0);
      return;
    }
    const timer = window.setTimeout(() => {
      setFrame((current) => (current + 1) % IDLE_FRAME_DURATIONS.length);
    }, IDLE_FRAME_DURATIONS[frame]);
    return () => window.clearTimeout(timer);
  }, [frame, reducedMotion]);

  const rows = spriteVersionNumber === 2 ? 11 : 9;
  const horizontalPosition = (frame / 7) * 100;

  return (
    <div
      role="img"
      aria-label={alt}
      data-frame={frame}
      className="h-[86%] max-h-40 aspect-[12/13] bg-no-repeat"
      style={{
        backgroundImage: `url("${src}")`,
        backgroundSize: `800% ${rows * 100}%`,
        backgroundPosition: `${horizontalPosition}% 0%`,
      }}
    />
  );
}

export function AgentAppearancePreview({
  agentId,
  assetId,
  kind,
  alt,
  spriteVersionNumber = 1,
}: AgentAppearancePreviewProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const request =
      kind === "theme"
        ? window.api.agent.getAppearanceThemePreview(agentId, assetId)
        : window.api.agent.getAgentPetPreview(agentId, assetId);
    void request
      .then((value) => {
        if (active) setSrc(value);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [agentId, assetId, kind]);

  return (
    <div
      className={`flex items-center justify-center overflow-hidden border-b border-border/70 bg-muted/30 ${kind === "pet" ? "aspect-[4/3]" : "aspect-[16/9]"}`}
    >
      {src ? (
        kind === "pet" ? (
          <AgentPetAnimationPreview
            src={src}
            alt={alt}
            spriteVersionNumber={spriteVersionNumber}
          />
        ) : (
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        )
      ) : (
        <ImageIcon className="h-8 w-8 text-muted-foreground/45" />
      )}
    </div>
  );
}
