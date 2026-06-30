import { createContext } from "react";

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

export type ToastInput = {
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms; pass 0 to keep it until dismissed. */
  duration?: number;
};

export type ToastContextValue = {
  notify: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
