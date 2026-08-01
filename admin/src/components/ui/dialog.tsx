import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Built on <dialog>, which gives focus trapping, Escape handling and the
 * top layer for free — all of which a div-based modal has to reimplement,
 * usually incompletely.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Escape fires `cancel`; keep React state the source of truth.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      className={cn(
        "m-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-0 shadow-lg",
        "backdrop:bg-slate-900/40",
        className
      )}
      // Clicking the backdrop closes; clicking the panel must not.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="px-5 py-4">
        <h2 id="dialog-title" className="text-sm font-semibold text-slate-900">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        {children && <div className="mt-4">{children}</div>}
      </div>
      {footer && (
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
