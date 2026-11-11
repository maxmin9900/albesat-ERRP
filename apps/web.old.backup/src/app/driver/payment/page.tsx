"use client";

import { useDriverOrders } from "@/lib/api/driver-hooks";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export default function DriverPaymentPage() {
  const { data } = useDriverOrders();
  const firstDelivery = data?.deliveries[0];

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-xl font-bold text-navy">Collect Payment</h1>
        <p className="text-sm text-muted">Select method and record the transaction.</p>
      </div>

      {firstDelivery ? (
        <div className="relative overflow-hidden rounded-2xl bg-navy p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Invoice summary</p>
          <div className="mt-4 flex items-start justify-between">
            <div>
              <p className="text-sm text-white/80">#{firstDelivery.tracking_code}</p>
              <p className="mt-1 text-xl font-bold">{firstDelivery.customer_name}</p>
              <p className="mt-1 text-primary">{firstDelivery.service_label}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{formatCurrency(Number(firstDelivery.total))}</p>
              <p className="text-sm text-white/70">USD</p>
            </div>
          </div>
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
        </div>
      ) : (
        <p className="rounded-xl bg-surface-alt p-6 text-center text-muted">No pending deliveries to collect.</p>
      )}

      <p className="text-center text-sm text-muted">
        For full delivery payment flow with success confirmation, use the{" "}
        <Link href="/driver" className="font-semibold text-primary">
          Deliveries tab
        </Link>
        .
      </p>
    </div>
  );
}
