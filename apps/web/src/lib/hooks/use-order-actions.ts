"use client";

import { Order, useDeleteOrder } from "@/lib/api/hooks";
import { useCallback, useState } from "react";

export function useOrderActions() {
  const deleteOrder = useDeleteOrder();
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const handleView = useCallback((order: Order) => {
    setViewOrder(order);
    setDetailOpen(true);
  }, []);

  const handleEdit = useCallback((order: Order) => {
    setDetailOpen(false);
    setEditOrder(order);
    setEditOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (order: Order) => {
      const label = order.order_number || order.id;
      if (
        !window.confirm(
          `Permanently delete order ${label}? This removes it and all its data and cannot be undone.`,
        )
      ) {
        return;
      }
      try {
        await deleteOrder.mutateAsync(order.id);
      } catch (e) {
        const msg =
          e instanceof Error
            ? e.message
            : "Failed to delete order";
        window.alert(msg.includes("orders:delete") ? "You do not have permission to delete orders." : msg);
      }
    },
    [deleteOrder],
  );

  return {
    viewOrder,
    editOrder,
    detailOpen,
    editOpen,
    setDetailOpen,
    setEditOpen,
    handleView,
    handleEdit,
    handleDelete,
    isDeleting: deleteOrder.isPending,
  };
}
