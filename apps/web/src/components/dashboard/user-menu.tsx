"use client";

import { apiFetch } from "@/lib/api/client";
import { ROLE_LABELS } from "@/lib/auth-roles";
import { useSelectedRole } from "@/lib/hooks/use-selected-role";
import { useAuthStore } from "@/lib/stores/auth";
import { cn } from "@/lib/utils";
import { ChevronDown, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const accessToken = useAuthStore((s) => s.accessToken);
  const selectedRole = useSelectedRole();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  const displayName = user?.full_name ?? "User";
  const roleLabel = selectedRole
    ? (ROLE_LABELS[selectedRole.slug] ?? selectedRole.name)
    : "Admin";

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        token: accessToken ?? undefined,
        skipAuthRetry: true,
      });
    } catch {
      /* clear local session even if API call fails */
    }
    logout();
    router.replace("/login");
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 transition-colors hover:bg-surface-alt",
          open && "bg-surface-alt",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {displayName[0]?.toUpperCase() ?? "U"}
        </span>
        <span className="hidden max-w-[140px] truncate text-sm font-medium text-navy sm:block">
          {displayName}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate font-semibold text-navy">{displayName}</p>
            <p className="truncate text-xs text-muted" dir="ltr">
              {user?.phone}
            </p>
            <p className="mt-1 text-xs font-medium text-primary">{roleLabel}</p>
          </div>
          <Link
            href="/admin/profile"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-navy hover:bg-surface-alt"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4 text-muted" />
            My profile
          </Link>
          <button
            type="button"
            role="menuitem"
            disabled={loggingOut}
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-danger hover:bg-red-50 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
