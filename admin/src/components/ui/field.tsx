import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Pairs a real <label> with its control, plus hint and error wiring.
 *
 * Placeholder-as-label is never acceptable: placeholders vanish on focus and
 * are not reliably announced. The public site's ContactForm has that defect;
 * this app does not inherit it. docs/ADMIN_UI_ARCHITECTURE.md §8
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span className="text-red-600" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>

      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: htmlFor,
            "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
            "aria-invalid": error ? true : undefined,
            "aria-required": required || undefined,
          })
        : children}

      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}

      {/* aria-live so a validation failure is announced, not just shown. */}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
