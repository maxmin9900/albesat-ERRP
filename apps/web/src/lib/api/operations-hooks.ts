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
  carpet_type: string | null;
  dimensions: string | null;
  status: string;
  status_label: string;
  order_id: string;
  order_number: string;
  tracking_code: string;
  customer_name: string;
  customer_phone: string | null;
  service_type: string;
  service_label: string;
  current_step: string | null;
  received_at: string | null;
  qr_code: string | null;
  repair_status: string | null;
  repair_id: string | null;
  operation_started_at: string | null;
  operation_completed_at: string | null;
  loaded_for_delivery_at: string | null;
  loaded_for_driver_id: string | null;
  loaded_for_driver_name: string | null;
}

export interface OperationsQueue {
  received: OperationCarpetItem[];
  in_operation: OperationCarpetItem[];
  drying: OperationCarpetItem[];
  ready: OperationCarpetItem[];
}

export interface DriverOption {
  id: string;
  full_name: string;
  phone: string | null;
}

export type OperationCarpetDetail = OperationCarpetItem & {
  operation_logs: { operation: string; note: string | null; created_at: string }[];
  status_timeline: unknown[];
};

export function useOperationsQueue() {
  const token = useToken();
  return useQuery({
    queryKey: ["operations", "queue"],
    queryFn: () => apiFetch<OperationsQueue>("/operations/queue", { token: token! }),
    enabled: !!token,
    refetchInterval: 15_000,
  });
}

export function useOperationsDrivers() {
  const token = useToken();
  return useQuery({
    queryKey: ["operations", "drivers"],
    queryFn: () => apiFetch<DriverOption[]>("/operations/drivers", { token: token! }),
    enabled: !!token,
  });
}

export function useReceiveCarpet() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<OperationCarpetDetail>("/operations/receive", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() }),
        token: token!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operations"] }),
  });
}

export function useStartOperation() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<OperationCarpetDetail>("/operations/start", {
        method: "POST",
        body: JSON.stringify({ code: code.trim() }),
        token: token!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operations"] }),
  });
}

export function useLoadForDelivery() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { code: string; driver_id: string }) =>
      apiFetch<OperationCarpetDetail>("/operations/load", {
        method: "POST",
        body: JSON.stringify(body),
        token: token!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations"] });
      qc.invalidateQueries({ queryKey: ["driver"] });
    },
  });
}

export function useOperationCarpet(carpetId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["operations", "carpet", carpetId],
    queryFn: () =>
      apiFetch<OperationCarpetDetail>(`/operations/carpets/${carpetId}`, { token: token! }),
    enabled: !!token && !!carpetId,
  });
}

export function useRecordOperationStep(carpetId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { step: string; note?: string }) =>
      apiFetch<OperationCarpetDetail>(`/operations/carpets/${carpetId}/step`, {
        method: "POST",
        body: JSON.stringify(body),
        token: token!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operations"] }),
  });
}

export interface FlagRepairBody {
  code: string;
  damage_type: string;
  damage_description: string;
  photos?: { data_url: string; caption?: string | null }[];
}

export function useFlagRepairAtOperations() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FlagRepairBody) =>
      apiFetch<unknown>("/operations/flag-repair", {
        method: "POST",
        body: JSON.stringify(body),
        token: token!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations"] });
      qc.invalidateQueries({ queryKey: ["repairs"] });
    },
  });
}

export interface RepairWorkBody {
  repair_id: string;
  status: "in_repair" | "repair_completed";
  qr_code?: string;
  completion_notes?: string;
}

// US-31/US-32: operations starts/completes the admin-approved repair.
export function useRepairWorkFromOperations() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ repair_id, ...body }: RepairWorkBody) =>
      apiFetch<unknown>(`/repairs/${repair_id}/work`, {
        method: "PATCH",
        body: JSON.stringify(body),
        token: token!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations"] });
      qc.invalidateQueries({ queryKey: ["repairs"] });
    },
  });
}

export function useCompleteOperation(carpetId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<OperationCarpetDetail>(`/operations/carpets/${carpetId}/complete`, {
        method: "POST",
        token: token!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operations"] });
      qc.invalidateQueries({ queryKey: ["driver"] });
    },
  });
}
