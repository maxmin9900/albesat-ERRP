"use client";

import { RouteMapFrame } from "@/components/driver/route-map-frame";
import { Button } from "@/components/ui/button";
import { useDriverOrders, useDriverRoute } from "@/lib/api/driver-hooks";
import { cn } from "@/lib/utils";
import { Navigation, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

function useOrderFlowHref() {
  const { data: orders } = useDriverOrders();

  return useMemo(() => {
    const map = new Map<string, string>();
    if (!orders) return map;
    for (const o of orders.pending_pickup) map.set(o.id, `/driver/pickup/${o.id}`);
    for (const o of orders.pickup_in_progress) map.set(o.id, `/driver/pickup/${o.id}`);
    for (const o of orders.collected_pending_handoff) map.set(o.id, `/driver/handoff/${o.id}`);
    for (const o of orders.deliveries) map.set(o.id, `/driver/delivery/${o.id}`);
    return map;
  }, [orders]);
}

export default function DriverMapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, refetch, isFetching } = useDriverRoute();
  const orderHref = useOrderFlowHref();

  const [navigating, setNavigating] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const stops = data?.stops ?? [];

  const scrollToMap = () => {
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const startNavigateTo = useCallback(
    (index: number) => {
      setNavigating(true);
      setActiveIndex(index);
      scrollToMap();
    },
    [],
  );

  const handleStartNavigation = () => {
    if (!stops.length) return;
    startNavigateTo(0);
  };

  const handleCloseNavigation = () => {
    setNavigating(false);
    setActiveIndex(null);
  };

  return (
    <div className="p-4 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Route Map</h1>
          <p className="text-sm text-muted">
            {navigating && activeIndex !== null
              ? `Navigating to stop ${stops[activeIndex]?.stop_number}`
              : `${stops.length} stops on your route`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            refetch();
            handleCloseNavigation();
          }}
          disabled={isFetching}
          className="flex items-center gap-1 text-sm font-semibold text-navy disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Recalculate
        </button>
      </div>

      <div ref={mapRef}>
        <RouteMapFrame
          stops={stops}
          activeIndex={activeIndex}
          navigating={navigating}
          onCloseNavigation={handleCloseNavigation}
          onPrevStop={() => setActiveIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNextStop={() =>
            setActiveIndex((i) =>
              i !== null && i < stops.length - 1 ? i + 1 : i,
            )
          }
          totalDistanceKm={data?.total_distance_km}
          estMinutes={data?.est_minutes}
        />
      </div>

      {isLoading ? (
        <p className="mt-6 text-center text-muted">Loading route...</p>
      ) : !stops.length ? (
        <p className="mt-6 rounded-xl bg-white p-6 text-center text-sm text-muted shadow-sm">
          No stops yet. Accept pickups or deliveries from the Orders tab to see your route here.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {stops.map((stop, index) => {
            const href = orderHref.get(stop.order_id);
            const isActive = navigating && activeIndex === index;
            return (
              <li
                key={stop.order_id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition-colors",
                  isActive && "ring-2 ring-primary",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                    isActive ? "bg-primary" : "bg-navy",
                  )}
                >
                  {stop.stop_number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-navy">{stop.customer_name}</p>
                  <p className="truncate text-sm text-muted">
                    {stop.address || "No address on file"}
                  </p>
                  <p className="text-xs text-primary">#{stop.tracking_code}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={isActive ? "primary" : "outline"}
                    className="text-xs"
                    onClick={() => startNavigateTo(index)}
                  >
                    {isActive ? "On map" : "Navigate"}
                  </Button>
                  {href && (
                    <Link
                      href={href}
                      className="text-center text-[10px] font-semibold text-muted hover:text-primary"
                    >
                      Open order
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        className="mt-6 w-full"
        size="lg"
        onClick={handleStartNavigation}
        disabled={!stops.length}
      >
        <Navigation className="h-5 w-5" />
        {navigating ? "Navigation active" : "Start Navigation"}
      </Button>
    </div>
  );
}
