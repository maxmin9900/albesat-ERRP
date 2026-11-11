"use client";

import { OrdersTable } from "@/components/dashboard/orders-table";
import { DraftInvoiceModal } from "@/components/dashboard/modals/draft-invoice-modal";
import { OrderDetailModal } from "@/components/dashboard/modals/order-detail-modal";
import { OrderEditModal } from "@/components/dashboard/modals/order-edit-modal";
import { Button } from "@/components/ui/button";
import { useOrders, type Order } from "@/lib/api/hooks";
import { useMarkOrderPaid } from "@/lib/api/order-payment-hooks";
import { useOrderActions } from "@/lib/hooks/use-order-actions";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { useSelectedRole } from "@/lib/hooks/use-selected-role";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const actions = useOrderActions();
  const { has } = usePermissions();
  const selectedRole = useSelectedRole();
  const canDeleteOrders = has("orders:delete") || selectedRole?.slug === "super_admin";
  const canMarkPaid = has("orders:update") || has("payments:create") || selectedRole?.slug === "super_admin";
  const markPaid = useMarkOrderPaid();
  const [markingOrderId, setMarkingOrderId] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const canEditInvoice = has("payments:create") || selectedRole?.slug === "super_admin";

  const { data, isLoading } = useOrders({
    status: statusFilter,
    search: search || undefined,
    page,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Orders</h1>
          <p className="mt-1 text-muted">
            {data ? `${data.total} total orders` : "Manage all customer orders"}
          </p>
        </div>
        <Link href="/admin/orders/new">
          <Button>
            <Plus className="h-4 w-4" /> New Order
          </Button>
        </Link>
      </div>

      <div className="mt-8">
        <OrdersTable
          orders={data?.items ?? []}
          isLoading={isLoading}
          statusFilter={statusFilter}
          onStatusFilter={(s) => {
            setStatusFilter(s);
            setPage(1);
          }}
          search={search}
          onSearch={(s) => {
            setSearch(s);
            setPage(1);
          }}
          onView={actions.handleView}
          onEdit={actions.handleEdit}
          onInvoice={(order) => setInvoiceOrder(order)}
          onDelete={canDeleteOrders ? actions.handleDelete : undefined}
          onMarkPaid={
            canMarkPaid
              ? (order) => {
                  if (
                    !window.confirm(
                      `Mark order #${order.tracking_code} as paid? This cannot be undone.`,
                    )
                  ) {
                    return;
                  }
                  setMarkingOrderId(order.id);
                  void markPaid.mutateAsync(order.id).finally(() => setMarkingOrderId(null));
                }
              : undefined
          }
          markingPaidOrderId={markingOrderId}
          canDelete={canDeleteOrders}
        />
      </div>

      {data && data.total > data.page_size && (
        <div className="mt-4 flex justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center px-3 text-sm text-muted">Page {page}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page * data.page_size >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <OrderDetailModal
        order={actions.viewOrder}
        open={actions.detailOpen}
        onClose={() => actions.setDetailOpen(false)}
        onEdit={actions.handleEdit}
      />
      <OrderEditModal
        order={actions.editOrder}
        open={actions.editOpen}
        onClose={() => actions.setEditOpen(false)}
      />
      <DraftInvoiceModal
        order={invoiceOrder}
        open={invoiceOrder !== null}
        onClose={() => setInvoiceOrder(null)}
        canEdit={canEditInvoice}
      />
    </div>
  );
}
