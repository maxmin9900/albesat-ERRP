"use client";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function useToken() {
  return useAuthStore((s) => s.accessToken);
}

export interface PhysicalQrTag {
  id: string;
  code: string;
  label: string | null;
  is_active: boolean;
  in_use: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface PaginatedPhysicalQr {
  items: PhysicalQrTag[];
  total: number;
  page: number;
  page_size: number;
}

export function usePhysicalQrTags(params: { page?: number; search?: string }) {
  const token = useToken();
  const sp = new URLSearchParams();
  sp.set("page", String(params.page ?? 1));
  sp.set("page_size", "20");
  if (params.search) sp.set("search", params.search);

  return useQuery({
    queryKey: ["qr-registry", params],
    queryFn: () =>
      apiFetch<PaginatedPhysicalQr>(`/qr/registry?${sp.toString()}`, { token: token! }),
    enabled: !!token,
  });
}

export function useCreatePhysicalQr() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { code: string; label?: string }) =>
      apiFetch<PhysicalQrTag>("/qr/registry", {
        method: "POST",
        body: JSON.stringify(body),
        token: token!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qr-registry"] }),
  });
}

export function useBulkCreatePhysicalQr() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { codes: string[]; label_prefix?: string }) =>
      apiFetch<{ created: number; skipped: number; duplicates: string[] }>(
        "/qr/registry/bulk",
        {
          method: "POST",
          body: JSON.stringify(body),
          token: token!,
        },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qr-registry"] }),
  });
}

export function useTogglePhysicalQr() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch<PhysicalQrTag>(`/qr/registry/${id}/active?active=${active}`, {
        method: "PATCH",
        token: token!,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qr-registry"] }),
  });
}
