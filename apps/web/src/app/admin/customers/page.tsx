"use client";

import { Button } from "@/components/ui/button";
import { useAdminCustomers } from "@/lib/api/customers-hooks";
import { cn } from "@/lib/utils";
import { Eye, Mail, Phone, Plus } from "lucide-react";
import Link from "next/link";

const TIER_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  VIP: "bg-amber-100 text-amber-800",
  NEW: "bg-blue-100 text-blue-800",
};

export default function CustomersPage() {
  const { data, isLoading } = useAdminCustomers("");

  const customers = data?.items ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Customers</h1>
          <p className="mt-1 text-muted">Manage your customer database and loyalty tiers.</p>
        </div>
        <Link href="/admin/customers/new">
          <Button>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl bg-white shadow-sm">
        {isLoading ? (
          <p className="p-8 text-muted">Loading customers...</p>
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                <th className="p-4">Customer</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Orders</th>
                <th className="p-4">Total Spent</th>
                <th className="p-4">Tier</th>
                <th className="p-4">Payment</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    No customers found. Orders will populate this list.
                  </td>
                </tr>
              ) : (
                customers.map((c, i) => (
                  <tr key={c.phone} className="border-b border-border/60 hover:bg-surface-alt/50">
                    <td className="p-4">
                      <p className="font-semibold text-navy">{c.customer_name}</p>
                      <p className="text-xs text-muted">C{String(i + 1).padStart(3, "0")}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-navy" dir="ltr">
                        {c.phone}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-navy">{c.order_count}</p>
                      <p className="text-xs text-muted">
                        Last:{" "}
                        {c.last_order_at
                          ? new Date(c.last_order_at).toLocaleDateString("en-CA")
                          : "—"}
                      </p>
                    </td>
                    <td className="p-4 font-semibold text-navy">
                      {parseFloat(c.total_spent).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-bold",
                          TIER_STYLES[c.tier] ?? TIER_STYLES.NEW,
                        )}
                      >
                        {c.tier}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-navy">
                        {c.paid_order_count ?? 0} / {c.order_count} paid
                      </p>
                      <p className="text-xs text-muted">Mark each order in Orders</p>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2 text-muted">
                        <Link
                          href={`/admin/customers/${encodeURIComponent(c.phone)}`}
                          className="rounded-lg p-2 hover:bg-surface-alt hover:text-primary"
                          aria-label="View customer detail"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <a
                          href={`tel:${c.phone}`}
                          className="rounded-lg p-2 hover:bg-surface-alt"
                          aria-label="Call"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          className="rounded-lg p-2 hover:bg-surface-alt"
                          aria-label="Email"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
