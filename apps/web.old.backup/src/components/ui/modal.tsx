"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
}

export function Modal({ open, onClose, title, children, className, hideHeader }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handler = () => onClose();
    dialog.addEventListener("close", handler);
    return () => dialog.removeEventListener("close", handler);
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto w-full max-w-lg rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-navy/50 open:flex open:flex-col"
      aria-labelledby="modal-title"
    >
      <div className={cn("flex max-h-[90vh] flex-col", className)}>
        {!hideHeader && (
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 id="modal-title" className="text-lg font-bold text-navy">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-muted hover:bg-surface-alt hover:text-navy"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className={hideHeader ? "overflow-y-auto" : "overflow-y-auto px-6 py-5"}>{children}</div>
      </div>
    </dialog>
  );
}
