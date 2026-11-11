/** Per-order payment hooks for admin orders table. */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth";

export function useMarkOrderPaid() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      apiFetch<{ order_id: string; is_paid: boolean; paid_at: string; message: string }>(
        `/orders/${orderId}/mark-paid`,
        {
          method: "POST",
          body: "{}",
          token: token ?? undefined,
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] });
    },
  });
}
