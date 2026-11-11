"use client";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function useToken() {
  return useAuthStore((s) => s.accessToken);
}

export function useAuthenticatedFetch() {
  const token = useToken();
  return <T,>(path: string, options: RequestInit = {}) => {
    if (!token) throw new Error("Not authenticated");
    return apiFetch<T>(path, { ...options, token });
  };
}

export function useDashboardStats() {
  const token = useToken();
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () =>
      apiFetch<DashboardStats>("/dashboard/stats", { token: token! }),
    enabled: !!token,
  });
}

export function useOrderVolume(range: string) {
  const token = useToken();
  return useQuery({
    queryKey: ["dashboard", "volume", range],
    queryFn: () =>
      apiFetch<OrderVolumeResponse>(`/dashboard/order-volume?range=${range}`, { token: token! }),
    enabled: !!token,
  });
}

export function useOrderSources() {
  const token = useToken();
  return useQuery({
    queryKey: ["dashboard", "sources"],
    queryFn: () =>
      apiFetch<OrderSourcesResponse>("/dashboard/order-sources", { token: token! }),
    enabled: !!token,
  });
}

export function useDailyReport() {
  const token = useToken();
  return useQuery({
    queryKey: ["dashboard", "daily-report"],
    queryFn: () =>
      apiFetch<DailyReportResponse>("/dashboard/daily-report", { token: token! }),
    enabled: !!token,
  });
}

export function useOrders(params: {
  page?: number;
  status?: string;
  search?: string;
}) {
  const token = useToken();
  const sp = new URLSearchParams();
  sp.set("page", String(params.page ?? 1));
  sp.set("page_size", "10");
  if (params.status && params.status !== "all") sp.set("status", params.status);
  if (params.search) sp.set("search", params.search);

  return useQuery({
    queryKey: ["orders", params],
    queryFn: () =>
      apiFetch<PaginatedOrders>("/orders?" + sp.toString(), { token: token! }),
    enabled: !!token,
  });
}

export function useCreateOrder() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrderBody) =>
      apiFetch<Order>("/orders", { method: "POST", body: JSON.stringify(body), token: token! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useOrder(orderId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["orders", orderId],
    queryFn: () => apiFetch<OrderDetail>(`/orders/${orderId}`, { token: token! }),
    enabled: !!token && !!orderId,
  });
}

export function useUpdateOrder() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateOrderBody }) =>
      apiFetch<Order>(`/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
        token: token!,
      }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["orders", id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteOrder() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/orders/${id}`, { method: "DELETE", token: token! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCarpets(params: { page?: number; search?: string }) {
  const token = useToken();
  const sp = new URLSearchParams();
  sp.set("page", String(params.page ?? 1));
  sp.set("page_size", "20");
  if (params.search) sp.set("search", params.search);

  return useQuery({
    queryKey: ["carpets", params],
    queryFn: () =>
      apiFetch<PaginatedCarpets>("/qr/carpets?" + sp.toString(), { token: token! }),
    enabled: !!token,
  });
}

export function useCarpet(carpetId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["carpet", carpetId],
    queryFn: () =>
      apiFetch<CarpetDetail>(`/qr/carpets/${carpetId}`, { token: token! }),
    enabled: !!token && !!carpetId,
  });
}

export function useScanQr() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<QrScanResponse>("/qr/scan", {
        method: "POST",
        body: JSON.stringify({ code }),
        token: token!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carpets"] });
      qc.invalidateQueries({ queryKey: ["carpet"] });
    },
  });
}

export function useGenerateQr() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { order_id?: string; carpet_id?: string }) =>
      apiFetch<QrGenerateResponse>("/qr/generate", {
        method: "POST",
        body: JSON.stringify(body),
        token: token!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["carpets"] });
      qc.invalidateQueries({ queryKey: ["carpet"] });
    },
  });
}

export interface StatTrend {
  value: string;
  trend?: string | null;
  trend_up?: boolean | null;
  subtext: string;
}

export interface DashboardStats {
  todays_orders: StatTrend;
  monthly_revenue: StatTrend;
  in_washing: StatTrend;
  ready_for_delivery: StatTrend;
}

export interface VolumeDataPoint {
  day: string;
  count: number;
  is_today: boolean;
}

export interface OrderVolumeResponse {
  range: string;
  data: VolumeDataPoint[];
}

export interface SourceBreakdownItem {
  source: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface OrderSourcesResponse {
  total: number;
  sources: SourceBreakdownItem[];
}

export interface DailyReportResponse {
  date: string;
  stats: { label: string; value: string; subtext?: string | null; trend?: string | null }[];
  highlights: string[];
}

export interface Order {
  id: string;
  order_number: string;
  tracking_code: string;
  customer_name: string;
  customer_phone: string;
  carpet_description: string | null;
  source: string;
  service_type: string;
  status: string;
  total: string;
  currency: string;
  notes?: string | null;
  pickup_address?: string | null;
  partner_id?: string | null;
  partner_name?: string | null;
  session_code?: string | null;
  customer_email?: string | null;
  created_at: string;
}

export interface OrderDetail extends Order {
  subtotal?: string;
  tax?: string;
  updated_at?: string;
}

export interface UpdateOrderBody {
  customer_name?: string;
  customer_phone?: string;
  carpet_description?: string | null;
  notes?: string | null;
  pickup_address?: string | null;
  status?: string;
}

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateOrderBody {
  customer_name: string;
  phone: string;
  customer_email?: string;
  carpet_description?: string;
  source?: string;
  service_type?: string;
  notes?: string;
  pickup_address?: string;
  partner_id?: string;
  partner_reference?: string;
}

export interface TrackingHistoryItem {
  event_type: string;
  title: string;
  description: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface ScanLogItem {
  id: string;
  scan_method: string;
  is_valid: boolean;
  note: string | null;
  scanned_by_name: string | null;
  created_at: string;
}

export interface CarpetDetail {
  id: string;
  carpet_code: string;
  description: string | null;
  dimensions: string | null;
  status: string;
  location_note: string | null;
  order_id: string;
  order_number: string;
  tracking_code: string;
  customer_name: string;
  customer_phone: string;
  order_status: string;
  order_status_label: string;
  service_type: string;
  total: string;
  currency: string;
  qr_code: string | null;
  qr_issued_at: string | null;
  last_scanned_at: string | null;
  created_at: string;
  scan_logs: ScanLogItem[];
  status_timeline: { id: string; from_status: string | null; to_status: string; note: string | null; created_at: string }[];
  delivery_logs: { id: string; event_type: string; location: string | null; note: string | null; created_at: string }[];
  operation_logs: { id: string; operation: string; note: string | null; created_at: string }[];
  tracking_history: TrackingHistoryItem[];
}

export interface QrScanResponse {
  valid: boolean;
  carpet: CarpetDetail | null;
  message: string | null;
}

export interface CarpetListItem {
  id: string;
  carpet_code: string;
  description: string | null;
  status: string;
  order_number: string;
  tracking_code: string;
  customer_name: string;
  has_qr: boolean;
  created_at: string;
}

export interface PaginatedCarpets {
  items: CarpetListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface QrGenerateResponse {
  carpet_id: string;
  carpet_code: string;
  qr_code: string;
  qr_image_svg: string;
  issued_at: string;
  order_number: string;
  tracking_code: string;
}
