"use client";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth";
import { useQuery } from "@tanstack/react-query";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  href: string;
  category: string;
  created_at: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  total: number;
}

const READ_KEY = "fz_read_notifications";

function readIds(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function markNotificationRead(id: string): void {
  const ids = readIds();
  ids.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}

export function markAllNotificationsRead(ids: string[]): void {
  const current = readIds();
  for (const id of ids) current.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify([...current]));
}

export function isNotificationRead(id: string): boolean {
  return readIds().has(id);
}

export function useNotifications() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<NotificationsResponse>("/notifications", { token: token! }),
    enabled: !!token,
    refetchInterval: 60_000,
  });
}

export function unreadCount(items: NotificationItem[]): number {
  const read = readIds();
  return items.filter((item) => !read.has(item.id)).length;
}
