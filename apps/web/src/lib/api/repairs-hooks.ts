"use client";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function useToken() {
  return useAuthStore((s) => s.accessToken);
}

export interface RepairPhoto {
  id: string;
  caption: string | null;
  created_at: string;
  view_url: string;
  data_url: string;
}

export interface RepairRequest {
  id: string;
  order_id: string;
  carpet_id: string;
  status: string;
  flagged_source: string | null;
  damage_type: string | null;
  damage_description: string | null;
  repair_type: string | null;
  quoted_price: string | null;
  repair_deadline: string | null;
  assessment_notes: string | null;
  completion_notes: string | null;
  customer_contact_notes: string | null;
  contacted_at: string | null;
  contacted_by_name: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  tracking_code: string;
  carpet_code: string;
  qr_code: string | null;
  carpet_description: string | null;
  carpet_dimensions: string | null;
  session_code: string | null;
  photos: RepairPhoto[];
  created_at: string;
}

export function useRepairApprovalQueue() {
  const token = useToken();
  return useQuery({
    queryKey: ["repairs", "approval"],
    queryFn: () =>
      apiFetch<{ items: RepairRequest[]; total: number }>("/repairs/approval-queue", {
        token: token!,
      }),
    enabled: !!token,
    select: (d) => d.items,
    refetchInterval: 15_000,
  });
}

export function useRepairWorkQueue() {
  const token = useToken();
  return useQuery({
    queryKey: ["repairs", "work"],
    queryFn: () =>
      apiFetch<{ items: RepairRequest[]; total: number }>("/repairs/work-queue", {
        token: token!,
      }),
    enabled: !!token,
    select: (d) => d.items,
    refetchInterval: 15_000,
  });
}

export function useRecordAssessment() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      repair_type,
      quoted_price,
      repair_deadline,
      assessment_notes,
    }: {
      id: string;
      repair_type: string;
      quoted_price: number;
      repair_deadline: string;
      assessment_notes?: string;
    }) =>
      apiFetch<RepairRequest>(`/repairs/${id}/assessment`, {
        method: "PATCH",
        token: token!,
        body: JSON.stringify({
          repair_type,
          quoted_price,
          repair_deadline,
          assessment_notes,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repairs"] }),
  });
}

export function useRecordCustomerContact() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      outcome,
      notes,
    }: {
      id: string;
      outcome: "approved" | "rejected" | "waiting";
      notes?: string;
    }) =>
      apiFetch<RepairRequest>(`/repairs/${id}/customer-contact`, {
        method: "PATCH",
        token: token!,
        body: JSON.stringify({ outcome, notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repairs"] }),
  });
}

export function useApproveRepairStart() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RepairRequest>(`/repairs/${id}/approve-start`, {
        method: "POST",
        token: token!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repairs"] }),
  });
}

export function useRejectRepair() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<RepairRequest>(`/repairs/${id}/reject`, {
        method: "POST",
        token: token!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repairs"] }),
  });
}

export function useUpdateRepairWork() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      qr_code,
      completion_notes,
    }: {
      id: string;
      status: "in_repair" | "repair_completed";
      qr_code?: string;
      completion_notes?: string;
    }) =>
      apiFetch<RepairRequest>(`/repairs/${id}/work`, {
        method: "PATCH",
        token: token!,
        body: JSON.stringify({ status, qr_code, completion_notes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repairs"] }),
  });
}

export const REPAIR_STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending assessment",
  waiting_customer_response: "Waiting customer approval",
  customer_approved: "Approved for repair",
  customer_rejected: "Rejected repair",
  in_repair: "In repair",
  repair_completed: "Repair completed",
  repair_cancelled: "Cancelled",
};
