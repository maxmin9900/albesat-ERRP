"use client";

import { apiFetch } from "@/lib/api/client";
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
  session_code: string | null;
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
  });
}

export function useDriverOrders() {
  const token = useToken();
  return useQuery({
    queryKey: ["driver", "orders"],
    queryFn: () => apiFetch<DriverOrdersList>("/driver/orders", { token: token! }),
    enabled: !!token,
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

export function useDriverRoute() {
  const token = useToken();
  return useQuery({
    queryKey: ["driver", "route"],
    queryFn: () =>
      apiFetch<{
        total_distance_km: string;
        stops_count: number;
        est_minutes: number;
        stops: { stop_number: number; order_id: string; customer_name: string; address: string; tracking_code: string; distance_km: string | null }[];
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
  return useDriverMutation<DriverOrderCard>(`/driver/deliveries/${orderId}/scan`);
}

export function useCompleteDelivery(orderId: string) {
  return useDriverMutation<DriverOrderCard>(`/driver/deliveries/${orderId}/complete`);
}
