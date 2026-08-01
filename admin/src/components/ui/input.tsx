import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 text-sm",
      "placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50",
      "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-500",
      "aria-[invalid=true]:border-red-500",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
