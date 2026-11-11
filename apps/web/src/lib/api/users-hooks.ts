"use client";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function useToken() {
  return useAuthStore((s) => s.accessToken);
}

export interface RoleBrief {
  id: string;
  slug: string;
  name: string;
}

export interface UserAdmin {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  is_active: boolean;
  roles: string[];
  last_login_at: string | null;
  created_at: string;
}

export interface UserListResponse {
  users: UserAdmin[];
  roles: RoleBrief[];
}

export function useAdminUsers() {
  const token = useToken();
  return useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<UserListResponse>("/admin/users", { token: token! }),
    enabled: !!token,
  });
}

export function useUpdateUserRoles() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role_slugs }: { userId: string; role_slugs: string[] }) =>
      apiFetch<UserAdmin>(`/admin/users/${userId}/roles`, {
        method: "PATCH",
        token: token!,
        body: JSON.stringify({ role_slugs }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}

export function useSetUserActive() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, is_active }: { userId: string; is_active: boolean }) =>
      apiFetch<UserAdmin>(`/admin/users/${userId}/active`, {
        method: "PATCH",
        token: token!,
        body: JSON.stringify({ is_active }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });
}
