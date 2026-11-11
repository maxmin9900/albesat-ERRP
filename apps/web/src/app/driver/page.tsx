"use client";

import { DriverOrderCardUI } from "@/components/driver/driver-order-card";
import { apiFetch } from "@/lib/api/client";
import {
  DriverOrderCard,
  useDriverDashboard,
  useDriverOrders,
} from "@/lib/api/driver-hooks";
import { useAuthStore } from "@/lib/stores/auth";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Box, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Tab = "pickups" | "deliveries";

export default function DriverOrdersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const [tab, setTab] = useState<Tab>("pickups");
  const [startingId, setStartingId] = useState<string | null>(null);
  const { data: dash } = useDriverDashboard();
  const { data, isLoading } = useDriverOrders();

  const handleStartPickup = async (order: DriverOrderCard) => {
    if (!token || startingId) return;
    setStartingId(order.id);
    try {
      await apiFetch(`/driver/pickups/${order.id}/accept`, {
        method: "POST",
        body: "{}",
        token,
      });
      await qc.invalidateQueries({ queryKey: ["driver"] });
      router.push(`/driver/map?focus=${order.id}&start=1`);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message.includes("fetch")
            ? "Cannot reach API server. Check that the API is running."
            : e.message
          : "Failed to start pickup";
      window.alert(msg);
    } finally {
      setStartingId(null);
    }
  };

  const tabs = [
    {
      id: "pickups" as const,
      label: "Pickups",
      icon: Box,
      count: (data?.pending_pickup.length ?? 0) + (data?.pickup_in_progress.length ?? 0),
    },
    {
      id: "deliveries" as const,
      label: "Deliveries",
      icon: Truck,
      count: data?.deliveries.length ?? 0,
    },
  ];

  return (
    <div>
      {tab === "pickups" && dash && (
        <div className="bg-navy px-4 py-4 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
            Today&apos;s route
          </p>
          <p className="text-lg font-bold">
            {dash.pickups_pending + dash.pickups_in_progress} pickups • {dash.deliveries_pending}{" "}
            deliveries
          </p>
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
            {data.pending_pickup.length > 0 && (
              <section>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">
                  Pending Pickup
                </p>
                <p className="mb-3 text-xs text-muted">
                  New orders are unassigned until you tap Start Pickup.
                </p>
                <div className="space-y-4">
                  {data.pending_pickup.map((o, i) => (
                    <DriverOrderCardUI
                      key={o.id}
                      order={o}
                      variant="pending"
                      index={i}
                      actionLabel={startingId === o.id ? "Starting..." : "Start Pickup"}
                      onAction={() => handleStartPickup(o)}
                      actionLoading={startingId === o.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {data.pickup_in_progress.length > 0 && (
              <section>
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">
                  Pickup In Progress
                </p>
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
            <p className="text-xs text-muted">Loaded in your vehicle — Out for Delivery</p>
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
            {!data.deliveries.length && (
              <p className="text-center text-muted">No deliveries pending.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
