import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

const baseInput =
  "w-full rounded-xl border border-border bg-surface-light text-sm text-white placeholder-zinc-600 outline-none transition-all duration-150 focus:border-primary/50 focus:ring-2 focus:ring-primary/20";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`h-10 px-3.5 ${baseInput} ${className}`}
      {...props}
    />
  ),
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", ...props }, ref) => (
    <textarea
      ref={ref}
      className={`px-3.5 py-2.5 resize-none ${baseInput} ${className}`}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
