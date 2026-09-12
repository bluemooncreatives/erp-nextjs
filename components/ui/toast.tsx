"use client";

import { toast as toastify } from "react-toastify";

/**
 * Drop-in replacement for sonner's call surface (`toast.success(message,
 * { description })`, etc.), backed by react-toastify.
 *
 * The point of this shim is that every call site in the app keeps calling
 * `toast.success("Title", { description: "..." })` unchanged — only the
 * import path moves from `"sonner"` to here. react-toastify has no built-in
 * two-line title/description layout, so it's composed here once instead of
 * at each of the ~50 call sites.
 */

export interface ToastOptions {
  description?: string;
  /** Milliseconds before auto-dismiss — same unit as sonner's `duration`. */
  duration?: number;
}

function content(message: string, description?: string) {
  if (!description) return message;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">{message}</span>
      <span className="text-xs opacity-80">{description}</span>
    </div>
  );
}

function toastifyOptions(options?: ToastOptions) {
  return options?.duration !== undefined ? { autoClose: options.duration } : undefined;
}

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    toastify.success(content(message, options?.description), toastifyOptions(options)),
  error: (message: string, options?: ToastOptions) =>
    toastify.error(content(message, options?.description), toastifyOptions(options)),
  info: (message: string, options?: ToastOptions) =>
    toastify.info(content(message, options?.description), toastifyOptions(options)),
  warning: (message: string, options?: ToastOptions) =>
    toastify.warning(content(message, options?.description), toastifyOptions(options)),
};
