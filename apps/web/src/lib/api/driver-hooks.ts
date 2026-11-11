"use client";

import { apiFetch } from "@/lib/api/client";
import type { DraftInvoice } from "@/lib/api/payments-hooks";
import { useAuthStore } from "@/lib/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function useToken() {
  return useAuthStore((s) => s.accessToken);
}

export interface DriverOrderCard {
  id: string;
  order_number: string;
  tracking_code: string;
  customer_name: string;
  customer_phone: string;
  pickup_address: string | null;
  house_number?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  carpet_description: string | null;
  carpet_count: number;
  carpet_dimensions: string | null;
  source: string;
  service_type: string;
  service_label: string;
  status: string;
  status_label: string;
  pickup_workflow: string | null;
  delivery_workflow: string | null;
  total: string;
  currency: string;
  distance_km: string | null;
  pickup_started_at: string | null;
  assigned_to_me: boolean;
  has_qr: boolean;
  carpet_code: string | null;
  carpet_type: string | null;
  session_code: string | null;
  qr_code: string | null;
  loaded_at: string | null;
  invoice_number: string | null;
  invoice_total: string | null;
  payment_status: string;
  payment_status_label: string;
  carpets?: CarpetSummary[];
}

export interface CarpetSummary {
  id: string;
  carpet_code: string;
  dimensions: string | null;
  price: string | null;
  carpet_type: string | null;
  qr_code: string | null;
  has_qr: boolean;
  needs_repair: boolean;
}

export interface DeliveryScanResult {
  order: DriverOrderCard;
  carpet_id: string;
  qr_code: string;
  carpet_type: string | null;
  customer_name: string;
  customer_phone: string;
  service_label: string;
  invoice_number: string | null;
  invoice_total: string;
  payment_status: string;
  payment_status_label: string;
  message: string;
}

export interface DeliveryInvoice {
  invoice_number?: string | null;
  total?: string | number | null;
  payment_status?: string;
  payment_status_label?: string;
  issued_at?: string | null;
}

export interface CompleteDeliveryResult {
  order: DriverOrderCard;
  invoice: DeliveryInvoice;
  message: string;
}

export interface DriverOrdersList {
  pending_pickup: DriverOrderCard[];
  pickup_in_progress: DriverOrderCard[];
  collected_pending_handoff: DriverOrderCard[];
  deliveries: DriverOrderCard[];
  history: DriverOrderCard[];
  route_summary: Record<string, string | number>;
}

export interface DriverDashboard {
  done_today: number;
  pickups_pending: number;
  pickups_in_progress: number;
  pickups_collected: number;
  deliveries_pending: number;
  route_distance_km: string;
  route_stops: number;
  route_est_minutes: number;
  collectible_total: string;
  carpets_ready: number;
}

export function useDriverDashboard() {
  const token = useToken();
  return useQuery({
    queryKey: ["driver", "dashboard"],
    queryFn: () => apiFetch<DriverDashboard>("/driver/dashboard", { token: token! }),
    enabled: !!token,
    refetchInterval: 20_000,
  });
}

export function useDriverOrders() {
  const token = useToken();
  return useQuery({
    queryKey: ["driver", "orders"],
    queryFn: () => apiFetch<DriverOrdersList>("/driver/orders", { token: token! }),
    enabled: !!token,
    refetchInterval: 20_000,
  });
}

export function useDriverOrder(orderId: string | null) {
  const token = useToken();
  return useQuery({
    queryKey: ["driver", "order", orderId],
    queryFn: () => apiFetch<DriverOrderCard>(`/driver/orders/${orderId}`, { token: token! }),
    enabled: !!token && !!orderId,
  });
}

export interface DriverQuickScanResult {
  action: string;
  message: string;
  order_id: string | null;
  tracking_code: string | null;
  order: DriverOrderCard | null;
  candidate_orders: DriverOrderCard[];
}

export function useDriverQuickScan() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { code: string; order_id?: string }) =>
      apiFetch<DriverQuickScanResult>("/driver/quick-scan", {
        method: "POST",
        body: JSON.stringify(body),
        token: token!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver"] });
    },
  });
}

export function useDriverRoute() {
  const token = useToken();
  return useQuery({
    queryKey: ["driver", "route"],
    queryFn: () =>
      apiFetch<{
        total_distance_km: string;
        stops_count: number;
        est_minutes: number;
        stops: {
          stop_number: number;
          order_id: string;
          customer_name: string;
          address: string;
          latitude?: string | null;
          longitude?: string | null;
          tracking_code: string;
          distance_km: string | null;
        }[];
      }>("/driver/route", { token: token! }),
    enabled: !!token,
  });
}

function useDriverMutation<T>(path: string, method = "POST") {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown = undefined) =>
      apiFetch<T>(path, {
        method,
        body: body !== undefined ? JSON.stringify(body) : "{}",
        token: token!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver"] });
    },
  });
}

export function useAcceptPickup(orderId: string) {
  return useDriverMutation<{ order: DriverOrderCard }>(`/driver/pickups/${orderId}/accept`);
}

export function useStartPickup(orderId: string) {
  return useDriverMutation<DriverOrderCard>(`/driver/pickups/${orderId}/start`);
}

export function useGeneratePickupQr(orderId: string) {
  return useDriverMutation<{
    qr_code: string;
    carpet_code: string;
    session_code: string;
    issued_at: string;
  }>(`/driver/pickups/${orderId}/generate-qr`);
}

export function useConfirmPickup(orderId: string) {
  return useDriverMutation<DriverOrderCard>(`/driver/pickups/${orderId}/confirm`);
}

export interface PickupDetailsBody {
  carpet_count: number;
  dimensions?: string | null;
  price?: number | null;
}

export interface CarpetEntryBody {
  code: string;
  carpet_type?: string | null;
  length?: number | null;
  width?: number | null;
  price?: number | null;
  needs_repair?: boolean;
  damage_description?: string | null;
}

export interface PickupCarpetsBody {
  carpets: CarpetEntryBody[];
}

export function useSavePickupCarpets(orderId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PickupCarpetsBody) =>
      apiFetch<DriverOrderCard>(`/driver/pickups/${orderId}/carpets`, {
        method: "POST",
        body: JSON.stringify(body),
        token: token!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver"] });
    },
  });
}

export function useSavePickupDetails(orderId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PickupDetailsBody) =>
      apiFetch<DriverOrderCard>(`/driver/pickups/${orderId}/details`, {
        method: "POST",
        body: JSON.stringify(body),
        token: token!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["driver"] });
    },
  });
}

export function useScanHandoff(orderId: string) {
  return useDriverMutation<DriverOrderCard>(`/driver/pickups/${orderId}/handoff/scan`);
}

export function useConfirmHandoff(orderId: string) {
  return useDriverMutation<DriverOrderCard>(`/driver/pickups/${orderId}/handoff/confirm`);
}

export function useStartDelivery(orderId: string) {
  return useDriverMutation<DriverOrderCard>(`/driver/deliveries/${orderId}/start`);
}

export function useScanDelivery(orderId: string) {
  return useDriverMutation<DeliveryScanResult>(`/driver/deliveries/${orderId}/scan`);
}

export function useCompleteDelivery(orderId: string) {
  return useDriverMutation<CompleteDeliveryResult>(`/driver/deliveries/${orderId}/complete`);
}

// --- Draft invoice (پیش‌فاکتور) — driver confirmation flow -------------------

export function usePickupInvoice(orderId: string | null, enabled = true) {
  const token = useToken();
  return useQuery({
    queryKey: ["driver", "pickup-invoice", orderId],
    queryFn: () =>
      apiFetch<DraftInvoice>(`/driver/pickups/${orderId}/invoice`, { token: token! }),
    enabled: !!token && !!orderId && enabled,
    retry: false,
  });
}

export function useConfirmPickupInvoice(orderId: string) {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<DraftInvoice>(`/driver/pickups/${orderId}/invoice/confirm`, {
        method: "POST",
        body: "{}",
        token: token!,
      }),
    onSuccess: (data) => {
      qc.setQueryData(["driver", "pickup-invoice", orderId], data);
    },
  });
}
