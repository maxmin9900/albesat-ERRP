"use client";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function useToken() {
  return useAuthStore((s) => s.accessToken);
}

export interface PaymentTransaction {
  id: string;
  transaction_number: string;
  order_id: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  note: string | null;
  created_at: string;
  customer_name: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  invoice_type: string;
  status: string;
  subtotal: string;
  tax: string;
  total: string;
  currency: string;
  issued_at: string | null;
  paid_at: string | null;
  customer_name: string | null;
}

export interface Settlement {
  id: string;
  partner_id: string;
  partner_name: string;
  period_start: string;
  period_end: string;
  total_orders: number;
  gross_amount: string;
  commission_amount: string;
  net_payable: string;
  status: string;
  paid_at: string | null;
}

export interface PaymentsDashboard {
  today_revenue: string;
  pending_count: number;
  partner_settlement_pending: string;
  transactions: PaymentTransaction[];
  invoices: Invoice[];
  settlements: Settlement[];
}

export interface Partner {
  id: string;
  name: string;
  slug: string;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  commission_rate: string;
  is_active: boolean;
  order_count: number;
}

export function usePaymentsDashboard() {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "dashboard"],
    queryFn: () => apiFetch<PaymentsDashboard>("/payments/dashboard", { token: token! }),
    enabled: !!token,
  });
}

export function usePartners() {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "partners"],
    queryFn: () => apiFetch<Partner[]>("/payments/partners", { token: token! }),
    enabled: !!token,
  });
}

export function useRecordPayment() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { order_id: string; amount: number; method: string; note?: string }) =>
      apiFetch<PaymentTransaction>("/payments/record", {
        method: "POST",
        token: token!,
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });
}

export function usePaySettlement() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settlementId: string) =>
      apiFetch<Settlement>(`/payments/settlements/${settlementId}/pay`, {
        method: "POST",
        token: token!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });
}
