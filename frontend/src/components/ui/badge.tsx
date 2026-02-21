import type { HTMLAttributes, ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "purple";

const variants: Record<BadgeVariant, string> = {
  default: "border-border bg-surface-light text-zinc-400",
  primary: "border-primary/20 bg-primary/10 text-primary-light",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  danger: "border-red-500/20 bg-red-500/10 text-red-400",
  info: "border-cyan-500/20 bg-cyan-500/10 text-cyan-400",
  purple: "border-purple-500/20 bg-purple-500/10 text-purple-400",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: string;
}

export function Badge({
  variant = "default",
  dot,
  children,
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {children}
    </span>
  );
}
