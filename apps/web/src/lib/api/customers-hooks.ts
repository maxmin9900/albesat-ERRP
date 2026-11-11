import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth";

export interface AdminCustomerRow {
  phone: string;
  customer_name: string;
  order_count: number;
  last_order_at: string | null;
  total_spent: string;
  tier: string;
  is_paid: boolean;
  paid_order_count?: number;
  paid_at: string | null;
}

export function useAdminCustomers(search?: string) {
  const token = useAuthStore((s) => s.accessToken);
  const q = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return useQuery({
    queryKey: ["admin", "customers", search ?? ""],
    queryFn: () =>
      apiFetch<{ items: AdminCustomerRow[]; total: number }>(`/admin/customers${q}`, {
        token: token ?? undefined,
      }),
    enabled: !!token,
  });
}

export interface CustomerCreateInput {
  name: string;
  phone: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

export interface CustomerProfile {
  id: string;
  phone: string;
  name: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  notes: string | null;
  created_at: string;
}

export interface CustomerOrderLine {
  order_id: string;
  order_number: string;
  tracking_code: string;
  created_at: string;
  carpet_count: number;
  service_type: string;
  status: string;
  total: string;
  paid_amount: string;
  payment_status: string;
}

export interface CustomerDetail {
  phone: string;
  name: string;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  notes: string | null;
  has_profile: boolean;
  order_count: number;
  total_carpets: number;
  total_amount: string;
  paid_amount: string;
  remaining_amount: string;
  tier: string;
  first_order_at: string | null;
  last_order_at: string | null;
  orders: CustomerOrderLine[];
}

export function useCreateCustomer() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CustomerCreateInput) =>
      apiFetch<CustomerProfile>("/admin/customers", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] });
    },
  });
}

export function useCustomerDetail(phone: string | null) {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["admin", "customers", "detail", phone],
    queryFn: () =>
      apiFetch<CustomerDetail>(`/admin/customers/detail?phone=${encodeURIComponent(phone ?? "")}`, {
        token: token ?? undefined,
      }),
    enabled: !!token && !!phone,
  });
}

export function useMarkCustomerPaid() {
  const token = useAuthStore((s) => s.accessToken);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { phone: string; customer_name?: string }) =>
      apiFetch<{ phone: string; is_paid: boolean; paid_at: string; message: string }>(
        "/admin/customers/mark-paid",
        {
          method: "POST",
          token: token ?? undefined,
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "customers"] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
