"use client";

import { StatusBadge } from "@/components/dashboard/status-badge";
import { SourceBadge } from "@/components/dashboard/source-badge";
import { Order } from "@/lib/api/hooks";
import { cn, formatCurrency } from "@/lib/utils";
import { Eye, Pencil, Trash2, Check, Banknote, ReceiptText } from "lucide-react";
import Link from "next/link";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending_pickup", label: "Pending Pickup" },
  { id: "picked_up", label: "Picked Up" },
  { id: "in_washing", label: "Washing" },
  { id: "ready_for_delivery", label: "Ready for Delivery" },
  { id: "delivered", label: "Delivered" },
];

interface OrdersTableProps {
  orders: Order[];
  isLoading?: boolean;
  statusFilter: string;
  onStatusFilter: (s: string) => void;
  search: string;
  onSearch: (s: string) => void;
  compact?: boolean;
  onView?: (order: Order) => void;
  onEdit?: (order: Order) => void;
  onInvoice?: (order: Order) => void;
  onDelete?: (order: Order) => void;
  onMarkPaid?: (order: Order) => void;
  markingPaidOrderId?: string | null;
  canDelete?: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = ["bg-blue-500", "bg-purple-500", "bg-teal-500", "bg-orange-500", "bg-pink-500"];

export function OrdersTable({
  orders,
  isLoading,
  statusFilter,
  onStatusFilter,
  search,
  onSearch,
  compact,
  onView,
  onEdit,
  onInvoice,
  onDelete,
  onMarkPaid,
  markingPaidOrderId,
  canDelete,
}: OrdersTableProps) {
  return (
    <div className="rounded-2xl bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-4">
        {!compact && <h2 className="text-lg font-bold text-navy">Latest Orders</h2>}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onStatusFilter(f.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium",
                statusFilter === f.id ? "bg-navy text-white" : "bg-surface-alt text-muted hover:text-navy",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="rounded-lg border border-border bg-surface-alt px-3 py-1.5 text-sm outline-none focus:border-primary"
          aria-label="Search orders"
        />
      </div>

      <div className="overflow-x-auto">
        {isLoading ? (
          <p className="p-8 text-center text-sm text-muted">Loading orders...</p>
        ) : orders.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">No orders found.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => (
                <tr key={order.id} className="border-b border-border/60 hover:bg-surface-alt/50">
                  <td className="px-4 py-4 font-semibold text-navy">#{order.order_number.replace("ORD-", "")}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white",
                          AVATAR_COLORS[i % AVATAR_COLORS.length],
                        )}
                      >
                        {initials(order.customer_name)}
                      </span>
                      <div>
                        <p className="font-medium text-navy">{order.customer_name}</p>
                        <p className="text-xs text-muted">
                          {formatCurrency(Number(order.total), order.currency)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <SourceBadge source={order.source} />
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-4">
                    {order.is_paid ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
                        <Check className="h-3 w-3" />
                        Paid
                      </span>
                    ) : onMarkPaid ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-2.5 py-1 text-xs font-semibold text-navy hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                        disabled={markingPaidOrderId === order.id}
                        onClick={() => onMarkPaid(order)}
                      >
                        <Banknote className="h-3 w-3" />
                        {markingPaidOrderId === order.id ? "Saving…" : "Mark paid"}
                      </button>
                    ) : (
                      <span className="text-xs text-muted">Unpaid</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-muted">
                    {new Date(order.created_at).toLocaleDateString("en-CA").replace(/-/g, "/")}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2 text-muted">
                      <button
                        type="button"
                        className="rounded p-1 hover:bg-surface-alt hover:text-primary"
                        aria-label="View order"
                        onClick={() => onView?.(order)}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 hover:bg-surface-alt hover:text-primary"
                        aria-label="Edit order"
                        onClick={() => onEdit?.(order)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {onInvoice ? (
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-surface-alt hover:text-primary"
                          aria-label="Draft invoice"
                          onClick={() => onInvoice(order)}
                        >
                          <ReceiptText className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-surface-alt hover:text-danger"
                          aria-label="Cancel order"
                          onClick={() => onDelete?.(order)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!compact && (
        <div className="border-t border-border p-4 text-center">
          <Link href="/admin/orders" className="text-sm font-medium text-primary hover:underline">
            View All Orders →
          </Link>
        </div>
      )}
    </div>
  );
}
