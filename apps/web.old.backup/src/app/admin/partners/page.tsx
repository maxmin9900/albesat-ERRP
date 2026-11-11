"use client";

import { usePartners } from "@/lib/api/payments-hooks";
import Link from "next/link";

export default function PartnersPage() {
  const { data: partners, isLoading } = usePartners();

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Partners</h1>
          <p className="mt-1 text-muted">Referral partners, commission rates and linked orders</p>
        </div>
        <Link href="/admin/payments" className="text-sm font-medium text-primary hover:underline">
          Back to payments
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-8 text-muted">Loading partners...</p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(partners ?? []).map((p) => (
            <article key={p.id} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-navy">{p.name}</h2>
              <p className="text-xs text-muted">{p.slug}</p>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Commission</dt>
                  <dd className="font-semibold">{p.commission_rate}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Orders</dt>
                  <dd className="font-semibold">{p.order_count}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Phone</dt>
                  <dd>{p.contact_phone ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Email</dt>
                  <dd className="truncate text-right">{p.contact_email ?? "—"}</dd>
                </div>
              </dl>
              {p.address && <p className="mt-3 text-xs text-muted">{p.address}</p>}
              <span
                className={`mt-4 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                  p.is_active ? "bg-green-100 text-green-800" : "bg-surface-alt text-muted"
                }`}
              >
                {p.is_active ? "Active" : "Inactive"}
              </span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
