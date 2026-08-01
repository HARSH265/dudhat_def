import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native <select>, deliberately.
 *
 * A custom listbox costs keyboard handling, focus management, portal
 * positioning and mobile behaviour that the platform already gets right.
 * Nothing in this panel needs multi-select or option markup.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "h-9 w-full appearance-none rounded-md border border-slate-300 bg-white pl-3 pr-8 text-sm",
        "disabled:cursor-not-allowed disabled:bg-slate-50",
        "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500",
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown
      className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      aria-hidden
    />
  </div>
));
Select.displayName = "Select";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm",
      "placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50",
      "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
