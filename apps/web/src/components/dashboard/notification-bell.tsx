"use client";

import {
  markAllNotificationsRead,
  markNotificationRead,
  unreadCount,
  useNotifications,
} from "@/lib/api/notifications-hooks";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString("en-CA");
}

export function NotificationBell() {
  const { data, isLoading, refetch } = useNotifications();
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const items = data?.items ?? [];
  const unread = unreadCount(items);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) void refetch();
  };

  const handleItemClick = (id: string) => {
    markNotificationRead(id);
    bump((n) => n + 1);
    setOpen(false);
  };

  const handleMarkAll = () => {
    markAllNotificationsRead(items.map((i) => i.id));
    bump((n) => n + 1);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          "relative rounded-lg p-2 transition-colors hover:bg-surface-alt",
          open && "bg-surface-alt",
        )}
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5 text-muted" />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-white shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-semibold text-navy">Notifications</p>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <p className="p-4 text-sm text-muted">Loading...</p>
            ) : items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">No notifications right now.</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => handleItemClick(item.id)}
                  className="block border-b border-border/60 px-4 py-3 transition-colors hover:bg-surface-alt/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-navy">{item.title}</p>
                    <span className="shrink-0 text-[10px] text-muted">{formatWhen(item.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">{item.message}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
