"use client";

import { Button } from "@/components/ui/button";
import { useOrders } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { Eye, Mail, Phone, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const TIER_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  VIP: "bg-amber-100 text-amber-800",
  NEW: "bg-blue-100 text-blue-800",
};

function tierForOrderCount(count: number): string {
  if (count >= 5) return "VIP";
  if (count >= 2) return "ACTIVE";
  return "NEW";
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useOrders({ page: 1 });

  const customers = useMemo(() => {
    const map = new Map<
      string,
      { name: string; phone: string; orders: number; lastDate: string; total: number }
    >();
    for (const o of data?.items ?? []) {
      const key = o.customer_phone || o.customer_name;
      const existing = map.get(key);
      const amount = parseFloat(o.total) || 0;
      if (existing) {
        existing.orders += 1;
        existing.total += amount;
        if (o.created_at > existing.lastDate) existing.lastDate = o.created_at;
      } else {
        map.set(key, {
          name: o.customer_name,
          phone: o.customer_phone,
          orders: 1,
          lastDate: o.created_at,
          total: amount,
        });
      }
    }
    return Array.from(map.values())
      .filter(
        (c) =>
          !search ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search),
      )
      .sort((a, b) => b.orders - a.orders);
  }, [data?.items, search]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Customers</h1>
          <p className="mt-1 text-muted">Manage your customer database and loyalty tiers.</p>
        </div>
        <Link href="/admin/orders/new">
          <Button>
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        </Link>
      </div>

      <div className="relative mt-6 max-w-md">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Search by name or phone number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-white py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl bg-white shadow-sm">
        {isLoading ? (
          <p className="p-8 text-muted">Loading customers...</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                <th className="p-4">Customer</th>
                <th className="p-4">Contact</th>
                <th className="p-4">Orders</th>
                <th className="p-4">Total Spent</th>
                <th className="p-4">Tier</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted">
                    No customers found. Orders will populate this list.
                  </td>
                </tr>
              ) : (
                customers.map((c, i) => {
                  const tier = tierForOrderCount(c.orders);
                  return (
                    <tr key={c.phone + i} className="border-b border-border/60 hover:bg-surface-alt/50">
                      <td className="p-4">
                        <p className="font-semibold text-navy">{c.name}</p>
                        <p className="text-xs text-muted">C{String(i + 1).padStart(3, "0")}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-navy">{c.phone}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-medium text-navy">{c.orders}</p>
                        <p className="text-xs text-muted">
                          Last: {new Date(c.lastDate).toLocaleDateString("en-CA")}
                        </p>
                      </td>
                      <td className="p-4 font-semibold text-navy">
                        {c.total.toLocaleString()}
                      </td>
                      <td className="p-4">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-bold",
                            TIER_STYLES[tier],
                          )}
                        >
                          {tier}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2 text-muted">
                          <button type="button" className="rounded-lg p-2 hover:bg-surface-alt" aria-label="View">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button type="button" className="rounded-lg p-2 hover:bg-surface-alt" aria-label="Call">
                            <Phone className="h-4 w-4" />
                          </button>
                          <button type="button" className="rounded-lg p-2 hover:bg-surface-alt" aria-label="Email">
                            <Mail className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
