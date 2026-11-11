"use client";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/stores/auth";
import { useQuery } from "@tanstack/react-query";

interface ServiceSession {
  id: string;
  session_code: string;
  order_id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  created_at: string;
}

export default function AdminLogisticsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const { data, isLoading } = useQuery({
    queryKey: ["sessions", "service"],
    queryFn: () => apiFetch<ServiceSession[]>("/sessions/service", { token: token! }),
    enabled: !!token,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Logistics & Service Sessions</h1>
      <p className="mt-1 text-muted">Formal service sessions linked to each order</p>
      {isLoading ? (
        <p className="mt-8 text-muted">Loading...</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="p-4">Session</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((s) => (
                <tr key={s.id} className="border-b border-border/60">
                  <td className="p-4 font-semibold text-primary">{s.session_code}</td>
                  <td className="p-4">{s.customer_name}</td>
                  <td className="p-4">{s.customer_phone}</td>
                  <td className="p-4 capitalize">{s.status.replace(/_/g, " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
