import { useCallback, useEffect, useRef, useState } from "react";

interface SidebarResizeOptions {
  tagsSectionHeight: number;
  setTagsSectionHeight: (height: number) => void;
  resourceTagsSectionHeight: number;
  setResourceTagsSectionHeight: (height: number) => void;
}

function clampSidebarSectionHeight(value: number) {
  return Math.max(140, Math.min(window.innerHeight - 300, value));
}

export function useSidebarResizeController(options: SidebarResizeOptions) {
  const [isResizing, setIsResizing] = useState(false);
  const targetRef = useRef<"prompt" | "resource">("prompt");
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const handleResizeStart = useCallback(
    (event: React.MouseEvent, target: "prompt" | "resource" = "prompt") => {
      event.preventDefault();
      setIsResizing(true);
      targetRef.current = target;
      startYRef.current = event.clientY;
      startHeightRef.current =
        target === "prompt"
          ? options.tagsSectionHeight
          : options.resourceTagsSectionHeight;
      document.body.style.cursor = "ns-resize";
    },
    [options],
  );
  useSidebarResizeEvents(
    isResizing,
    targetRef,
    startYRef,
    startHeightRef,
    options,
    setIsResizing,
  );
  return { isResizing, handleResizeStart };
}

function useSidebarResizeEvents(
  isResizing: boolean,
  targetRef: React.MutableRefObject<"prompt" | "resource">,
  startYRef: React.MutableRefObject<number>,
  startHeightRef: React.MutableRefObject<number>,
  options: SidebarResizeOptions,
  setIsResizing: React.Dispatch<React.SetStateAction<boolean>>,
) {
  useEffect(() => {
    if (!isResizing) return;
    const move = (event: MouseEvent) => {
      const height = clampSidebarSectionHeight(
        startHeightRef.current + startYRef.current - event.clientY,
      );
      if (targetRef.current === "prompt") options.setTagsSectionHeight(height);
      else options.setResourceTagsSectionHeight(height);
    };
    const up = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [
    isResizing,
    options,
    setIsResizing,
    startHeightRef,
    startYRef,
    targetRef,
  ]);
}
