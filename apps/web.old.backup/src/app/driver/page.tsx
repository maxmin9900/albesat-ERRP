"use client";

import { AcceptPickupModal } from "@/components/driver/accept-pickup-modal";
import { DriverOrderCardUI } from "@/components/driver/driver-order-card";
import {
  DriverOrderCard,
  useAcceptPickup,
  useDriverDashboard,
  useDriverOrders,
} from "@/lib/api/driver-hooks";
import { cn, formatCurrency } from "@/lib/utils";
import { Box, Clock, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Tab = "pickups" | "deliveries" | "history";

export default function DriverOrdersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pickups");
  const [acceptOrder, setAcceptOrder] = useState<DriverOrderCard | null>(null);
  const { data: dash } = useDriverDashboard();
  const { data, isLoading } = useDriverOrders();
  const accept = useAcceptPickup(acceptOrder?.id ?? "");

  const tabs = [
    { id: "pickups" as const, label: "Pickups", icon: Box, count: (data?.pending_pickup.length ?? 0) + (data?.pickup_in_progress.length ?? 0) },
    { id: "deliveries" as const, label: "Deliveries", icon: Truck, count: data?.deliveries.length ?? 0 },
    { id: "history" as const, label: "History", icon: Clock, count: data?.history.length ?? 0 },
  ];

  const handleAccept = async () => {
    if (!acceptOrder) return;
    await accept.mutateAsync(undefined);
    setAcceptOrder(null);
    router.push(`/driver/pickup/${acceptOrder.id}`);
  };

  return (
    <div>
      {tab === "pickups" && dash && (
        <div className="bg-navy px-4 py-4 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">Today&apos;s route</p>
              <p className="text-lg font-bold">
                {dash.pickups_pending + dash.pickups_in_progress} pickups • {dash.deliveries_pending} deliveries
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-amber-300">{formatCurrency(Number(dash.collectible_total))}</p>
              <p className="text-[10px] text-white/60">Collectible</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-navy px-2 pb-2 pt-1">
        <div className="flex rounded-xl bg-navy-soft p-1">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition-colors",
                tab === id ? "bg-white text-navy" : "text-white/70",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  tab === id ? "bg-primary text-white" : "bg-white/20",
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6 p-4">
        {isLoading && <p className="text-center text-muted">Loading orders...</p>}

        {tab === "pickups" && data && (
          <>
            {data.deliveries.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Summary</p>
                <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Box className="h-6 w-6" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-muted">Carpets ready</p>
                    <p className="font-bold text-navy">{dash?.carpets_ready ?? 0} carpets</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted">Total to collect</p>
                    <p className="font-bold text-primary">{formatCurrency(Number(dash?.collectible_total ?? 0))}</p>
                  </div>
                </div>
              </section>
            )}

            {data.pending_pickup.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Pending Pickup</p>
                <div className="space-y-4">
                  {data.pending_pickup.map((o, i) => (
                    <DriverOrderCardUI
                      key={o.id}
                      order={o}
                      variant="pending"
                      index={i}
                      actionLabel="Start Pickup"
                      onAction={() => setAcceptOrder(o)}
                    />
                  ))}
                </div>
              </section>
            )}

            {data.pickup_in_progress.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">Pickup In Progress</p>
                <div className="space-y-4">
                  {data.pickup_in_progress.map((o, i) => (
                    <DriverOrderCardUI
                      key={o.id}
                      order={o}
                      variant="in_progress"
                      index={i}
                      actionLabel="Go to Customer"
                      actionHref={`/driver/pickup/${o.id}`}
                    />
                  ))}
                </div>
              </section>
            )}

            {data.collected_pending_handoff.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                  Collected — Pending Handoff
                </p>
                <div className="space-y-4">
                  {data.collected_pending_handoff.map((o, i) => (
                    <DriverOrderCardUI
                      key={o.id}
                      order={o}
                      variant="collected"
                      index={i}
                      actionLabel="Hand to Operations"
                      actionHref={`/driver/handoff/${o.id}`}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {tab === "deliveries" && data && (
          <div className="space-y-4">
            {data.deliveries.map((o, i) => (
              <DriverOrderCardUI
                key={o.id}
                order={o}
                variant="delivery"
                index={i}
                actionLabel="Deliver"
                actionHref={`/driver/delivery/${o.id}`}
              />
            ))}
            {!data.deliveries.length && <p className="text-center text-muted">No deliveries pending.</p>}
          </div>
        )}

        {tab === "history" && data && (
          <div className="space-y-4">
            {data.history.map((o, i) => (
              <DriverOrderCardUI key={o.id} order={o} variant="delivery" index={i} />
            ))}
            {!data.history.length && <p className="text-center text-muted">No history yet.</p>}
          </div>
        )}
      </div>

      <AcceptPickupModal
        order={acceptOrder}
        open={!!acceptOrder}
        onClose={() => setAcceptOrder(null)}
        onAccept={handleAccept}
        loading={accept.isPending}
      />
    </div>
  );
}
