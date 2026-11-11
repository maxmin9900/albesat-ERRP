"use client";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function useToken() {
  return useAuthStore((s) => s.accessToken);
}

export interface OperationCarpetItem {
  id: string;
  carpet_code: string;
  description: string | null;
  dimensions: string | null;
  status: string;
  status_label: string;
  order_id: string;
  order_number: string;
  tracking_code: string;
  customer_name: string;
  service_type: string;
  service_label: string;
  current_step: string | null;
  received_at: string | null;
}

export interface OperationsQueue {
  received: OperationCarpetItem[];
  in_operation: OperationCarpetItem[];
  drying: OperationCarpetItem[];
  ready: OperationCarpetItem[];
}

export function useOperationsQueue() {
  const token = useToken();
  return useQuery({
    queryKey: ["operations", "queue"],
    queryFn: () => apiFetch<OperationsQueue>("/operations/queue", { token: token! }),
    enabled: !!token,
  });
}

export function useOperationCarpet(carpetId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["operations", "carpet", carpetId],
    queryFn: () =>
      apiFetch<OperationCarpetItem & { qr_code: string | null; operation_logs: unknown[] }>(
        `/operations/carpets/${carpetId}`,
        { token: token! },
      ),
    enabled: !!token && !!carpetId,
  });
}

export function useScanOperation() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<OperationCarpetItem>(`/operations/scan`, {
        method: "POST",
        body: JSON.stringify({ code }),
        token: token!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operations"] }),
  });
}

export function useRecordOperationStep(carpetId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { step: string; note?: string }) =>
      apiFetch<OperationCarpetItem>(`/operations/carpets/${carpetId}/step`, {
        method: "POST",
        body: JSON.stringify(body),
        token: token!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operations"] }),
  });
}

export function useCompleteOperation(carpetId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<OperationCarpetItem>(`/operations/carpets/${carpetId}/complete`, {
        method: "POST",
        token: token!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations"] });
      qc.invalidateQueries({ queryKey: ["driver"] });
    },
  });
}
