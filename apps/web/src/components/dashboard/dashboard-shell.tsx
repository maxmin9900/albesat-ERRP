"use client";

import { Logo } from "@/components/ui/logo";
import { UserMenu } from "@/components/dashboard/user-menu";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Droplets,
  Truck,
  QrCode,
  CreditCard,
  BarChart3,
  Users,
  Settings,
  HelpCircle,
  Search,
  Shield,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  permission?: string;
};

const MAIN_NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/operations", label: "Wash Operations", icon: Droplets },
  { href: "/admin/logistics", label: "Logistics & Delivery", icon: Truck },
  { href: "/admin/tracking", label: "Carpet Tracking", icon: QrCode },
  { href: "/admin/qr-codes", label: "QR Codes", icon: QrCode },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/partners", label: "Partners", icon: Users },
  { href: "/admin/repairs", label: "Repair approvals", icon: Users },
  { href: "/admin/users", label: "Users & Roles", icon: Shield, permission: "users:manage" },
];

function navIsActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { has } = usePermissions();
  const navItems = MAIN_NAV.filter((item) => !item.permission || has(item.permission));

  return (
    <div className="flex min-h-screen bg-surface-alt">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-white p-4 lg:flex">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted">Main</p>
        <nav className="mt-2 flex-1 space-y-1" aria-label="Dashboard">
          {navItems.map((item) => {
            const active = navIsActive(pathname, item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-primary text-white" : "text-muted hover:bg-surface-alt hover:text-navy",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted">Settings</p>
        <Link
          href="/admin/settings"
          className={cn(
            "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            navIsActive(pathname, "/admin/settings")
              ? "bg-primary text-white"
              : "text-muted hover:bg-surface-alt hover:text-navy",
          )}
        >
          <Settings className="h-5 w-5" /> System Settings
        </Link>
        <Link
          href="/admin/support"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            navIsActive(pathname, "/admin/support")
              ? "bg-primary text-white"
              : "text-muted hover:bg-surface-alt hover:text-navy",
          )}
        >
          <HelpCircle className="h-5 w-5" /> Support
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-border bg-white px-4 py-3 lg:px-6">
          <Logo href="/admin" size="sm" />
          <div className="hidden flex-1 md:block">
            <div className="relative mx-auto max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Search (tracking code, customer name...)"
                className="w-full rounded-full bg-surface-alt py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <UserMenu />
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
