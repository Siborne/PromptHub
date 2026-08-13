import { forwardRef, InputHTMLAttributes, useId } from "react";
import { clsx } from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  variant?: "default" | "outlined";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      variant = "default",
      id,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy =
      [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : ariaInvalid}
          className={clsx(
            "w-full h-10 px-4",
            variant === "outlined"
              ? "rounded-md border border-input bg-background shadow-sm disabled:bg-muted/40 disabled:shadow-none"
              : "rounded-xl border-0 bg-muted/50",
            "text-sm placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
            variant === "outlined" && "focus:border-primary/50",
            variant === "default" && "focus:bg-background",
            "transition-all duration-base",
            error && "ring-2 ring-destructive/50",
            className,
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
