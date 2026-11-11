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
    setEditOrder(order);
    setEditOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (order: Order) => {
      const label = order.order_number || order.id;
      if (
        !window.confirm(
          `Delete order ${label}? This cannot be undone.`,
        )
      ) {
        return;
      }
      try {
        await deleteOrder.mutateAsync(order.id);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Failed to delete order");
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
