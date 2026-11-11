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
  driver_confirmed?: boolean;
  confirmation_reference?: string | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  service_session_id?: string | null;
  invoice_type: string;
  status: string;
  subtotal: string;
  tax: string;
  total: string;
  currency: string;
  issued_at: string | null;
  paid_at: string | null;
  delivered_at?: string | null;
  due_date?: string | null;
  amount_paid?: string;
  remaining_amount?: string;
  payment_status_label?: string;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  carpet_count?: number | null;
  service_type?: string | null;
  service_area?: string | null;
  service_amount?: string | null;
  repair_amount?: string | null;
  payment_status?: string;
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
  latitude?: string | null;
  longitude?: string | null;
  notes?: string | null;
  commission_rate: string;
  is_active: boolean;
  order_count: number;
}

export interface PartnerInput {
  name: string;
  contact_phone: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  contact_email?: string | null;
  commission_rate?: number;
  is_active?: boolean;
}

export function usePaymentsDashboard() {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "dashboard"],
    queryFn: () => apiFetch<PaymentsDashboard>("/payments/dashboard", { token: token! }),
    enabled: !!token,
  });
}

export function usePartners(includeInactive = true, enabled = true) {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "partners", includeInactive],
    queryFn: () =>
      apiFetch<Partner[]>(`/payments/partners?include_inactive=${includeInactive}`, {
        token: token!,
      }),
    enabled: !!token && enabled,
  });
}

export function useCreatePartner() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PartnerInput) =>
      apiFetch<Partner>("/payments/partners", {
        method: "POST",
        token: token!,
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments", "partners"] }),
  });
}

export function useUpdatePartner() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    // Partial: omitted fields (e.g. an unchanged legacy phone) are not sent,
    // so backend validation only applies to what actually changed.
    mutationFn: ({ id, ...body }: Partial<PartnerInput> & { id: string }) =>
      apiFetch<Partner>(`/payments/partners/${id}`, {
        method: "PATCH",
        token: token!,
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments", "partners"] }),
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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  partially_paid: "Partially Paid",
  paid: "Paid",
  failed_payment: "Failed Payment",
  overdue: "Overdue",
};

export function paymentStatusLabel(status: string | undefined): string {
  return PAYMENT_STATUS_LABELS[status ?? "unpaid"] ?? status ?? "Unpaid";
}

export function useReceivables() {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "receivables"],
    queryFn: () => apiFetch<Invoice[]>("/payments/receivables", { token: token! }),
    enabled: !!token,
  });
}

export interface InvoiceCrmDetail {
  invoice: Invoice;
  services_done: { label: string; amount: string }[];
  payment_history: PaymentTransaction[];
  reminder_logs: {
    id: string;
    invoice_id: string;
    channel: string;
    status: string;
    message: string | null;
    created_at: string;
  }[];
}

export interface PartnerFinanceReport {
  partner_id: string;
  partner_name: string;
  order_count: number;
  gross_order_amount: string;
  paid_amount: string;
  unpaid_amount: string;
  revenue_from_partner: string;
  partner_debt: string;
  payment_status_counts: Record<string, number>;
  settlements: Settlement[];
}

export function useInvoiceCrm(invoiceId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "invoice-crm", invoiceId],
    queryFn: () => apiFetch<InvoiceCrmDetail>(`/payments/invoices/${invoiceId}/crm`, { token: token! }),
    enabled: !!token && !!invoiceId,
  });
}

export function useSendPaymentReminder() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      apiFetch(`/payments/invoices/${invoiceId}/remind`, {
        method: "POST",
        token: token!,
        body: JSON.stringify({ channels: ["sms", "whatsapp"] }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });
}

export function usePartnerFinance(partnerId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "partner-finance", partnerId],
    queryFn: () =>
      apiFetch<PartnerFinanceReport>(`/payments/partners/${partnerId}/finance`, { token: token! }),
    enabled: !!token && !!partnerId,
  });
}

export function useGenerateSettlement() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ partnerId, year, month }: { partnerId: string; year: number; month: number }) =>
      apiFetch<Settlement>(`/payments/partners/${partnerId}/settlements/generate`, {
        method: "POST",
        token: token!,
        body: JSON.stringify({ year, month }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });
}

// ---------------------------------------------------------------------------
// Edit doc additions: partner detail / statement / delete + payment
// confirmation, pending list, history and revenue dashboard.
// ---------------------------------------------------------------------------

export interface PartnerOrderLine {
  order_id: string;
  order_number: string;
  created_at: string;
  carpet_count: number;
  service_type: string;
  status: string;
  total: string;
  paid_amount: string;
  payment_status: string;
}

export interface PartnerDetail {
  partner: Partner;
  total_orders: number;
  total_carpets: number;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  orders: PartnerOrderLine[];
}

export interface PartnerStatement {
  partner_id: string;
  partner_name: string;
  period_start: string;
  period_end: string;
  total_orders: number;
  total_carpets: number;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  orders: PartnerOrderLine[];
}

export interface OrderPaymentInfo {
  order_id: string;
  order_number: string;
  tracking_code: string;
  customer_name: string;
  customer_phone: string;
  order_status: string;
  total: string;
  currency: string;
  paid_amount: string;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
  is_locked: boolean;
}

export interface PaymentHistoryItem {
  id: string;
  transaction_number: string;
  order_id: string;
  order_number: string;
  customer_name: string | null;
  amount: string;
  currency: string;
  method: string;
  status: string;
  created_at: string;
}

export interface PaymentHistoryResponse {
  items: PaymentHistoryItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface RevenueDashboard {
  period: string;
  total_revenue: string;
  customer_revenue: string;
  partner_revenue: string;
  pending_payments_count: number;
}

export function usePartnerDetail(partnerId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "partner-detail", partnerId],
    queryFn: () =>
      apiFetch<PartnerDetail>(`/payments/partners/${partnerId}`, { token: token! }),
    enabled: !!token && !!partnerId,
  });
}

export function usePartnerStatement(partnerId: string | null, year: number, month: number) {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "partner-statement", partnerId, year, month],
    queryFn: () =>
      apiFetch<PartnerStatement>(
        `/payments/partners/${partnerId}/statement?year=${year}&month=${month}`,
        { token: token! },
      ),
    enabled: !!token && !!partnerId,
  });
}

export function useDeletePartner() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partnerId: string) =>
      apiFetch<Partner>(`/payments/partners/${partnerId}`, {
        method: "DELETE",
        token: token!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments", "partners"] }),
  });
}

export function usePendingPayments() {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "pending"],
    queryFn: () =>
      apiFetch<{ items: OrderPaymentInfo[]; total: number }>("/payments/pending", {
        token: token!,
      }),
    enabled: !!token,
  });
}

export function useOrderPaymentSearch(query: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "order-search", query],
    queryFn: () =>
      apiFetch<OrderPaymentInfo>(
        `/payments/orders/search?query=${encodeURIComponent(query ?? "")}`,
        { token: token! },
      ),
    enabled: !!token && !!query,
    retry: false,
  });
}

export function useConfirmOrderPayment() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, method, note }: { orderId: string; method: string; note?: string }) =>
      apiFetch<OrderPaymentInfo>(`/payments/orders/${orderId}/confirm`, {
        method: "POST",
        token: token!,
        body: JSON.stringify({ method, note }),
      }),
    onSuccess: () => {
      // Narrow invalidation: only the payment views affected by a confirmation.
      void qc.invalidateQueries({ queryKey: ["payments", "pending"] });
      void qc.invalidateQueries({ queryKey: ["payments", "history"] });
      void qc.invalidateQueries({ queryKey: ["payments", "revenue"] });
      void qc.invalidateQueries({ queryKey: ["payments", "order-search"] });
      void qc.invalidateQueries({ queryKey: ["payments", "receivables"] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function usePaymentHistory(page: number, pageSize = 20) {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "history", page, pageSize],
    queryFn: () =>
      apiFetch<PaymentHistoryResponse>(
        `/payments/history?page=${page}&page_size=${pageSize}`,
        { token: token! },
      ),
    enabled: !!token,
  });
}

export function useRevenueDashboard(period: string) {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "revenue", period],
    queryFn: () =>
      apiFetch<RevenueDashboard>(`/payments/revenue?period=${period}`, { token: token! }),
    enabled: !!token,
  });
}

// ---------------------------------------------------------------------------
// Draft invoice (پیش‌فاکتور) — EPIC Draft Invoice Management
// ---------------------------------------------------------------------------

export interface DraftInvoiceService {
  name: string;
  amount: string;
}

export interface DraftInvoiceItem {
  id: string;
  carpet_id: string | null;
  carpet_code: string | null;
  position: number;
  carpet_type: string | null;
  services: DraftInvoiceService[];
  amount: string;
}

export interface DraftInvoice {
  id: string;
  invoice_number: string;
  order_id: string;
  order_number: string;
  tracking_code: string;
  service_session_id: string | null;
  session_code: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  order_date: string;
  pickup_date: string | null;
  carpet_count: number;
  items: DraftInvoiceItem[];
  subtotal: string;
  tax: string;
  total: string;
  currency: string;
  payment_status: string;
  payment_status_label: string;
  invoice_status: "draft" | "confirmed" | "sent" | "final";
  editable: boolean;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  sent_at: string | null;
  sent_to_phone: string | null;
  sent_status: string | null;
}

export interface DraftInvoiceItemUpdate {
  carpet_id?: string | null;
  carpet_type?: string | null;
  services: { name: string; amount: string | number }[];
}

export function useDraftInvoice(orderId: string | null, open = true) {
  const token = useToken();
  return useQuery({
    queryKey: ["payments", "draft-invoice", orderId],
    queryFn: () =>
      apiFetch<DraftInvoice>(`/payments/orders/${orderId}/draft-invoice`, { token: token! }),
    enabled: !!token && !!orderId && open,
    retry: false,
  });
}

export function useUpdateDraftInvoice() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, items }: { invoiceId: string; items: DraftInvoiceItemUpdate[] }) =>
      apiFetch<DraftInvoice>(`/payments/invoices/${invoiceId}/draft`, {
        method: "PUT",
        token: token!,
        body: JSON.stringify({ items }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["payments", "draft-invoice", data.order_id], data);
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
