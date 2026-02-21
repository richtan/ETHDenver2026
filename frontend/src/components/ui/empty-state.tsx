import type { ReactNode } from "react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center shadow-sm"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-light">
        <Icon className="h-6 w-6 text-zinc-600" />
      </div>
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-zinc-600">{description}</p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </motion.div>
  );
}
