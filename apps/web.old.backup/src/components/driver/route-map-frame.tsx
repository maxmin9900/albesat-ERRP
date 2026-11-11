"use client";

import {
  buildLegPath,
  buildRoutePath,
  driverStartPoint,
  layoutStopsOnRoute,
  MapPoint,
  VIEW_H,
  VIEW_W,
} from "@/lib/route-map-layout";
import { cn } from "@/lib/utils";
import { MapPin, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export interface RouteMapStop {
  order_id: string;
  stop_number: number;
  customer_name: string;
  address: string;
  tracking_code: string;
  distance_km?: string | null;
}

interface RouteMapFrameProps {
  stops: RouteMapStop[];
  activeIndex: number | null;
  navigating: boolean;
  onCloseNavigation: () => void;
  onNextStop?: () => void;
  onPrevStop?: () => void;
  totalDistanceKm?: string;
  estMinutes?: number;
}

function useGeocode(address: string, enabled: boolean) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !address.trim()) {
      setCoords(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const q = encodeURIComponent(address.trim());
    fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
      headers: { Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((rows: { lat: string; lon: string }[]) => {
        if (cancelled || !rows?.[0]) return;
        setCoords({ lat: parseFloat(rows[0].lat), lon: parseFloat(rows[0].lon) });
      })
      .catch(() => setCoords(null))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, enabled]);

  return { coords, loading };
}

export function RouteMapFrame({
  stops,
  activeIndex,
  navigating,
  onCloseNavigation,
  onNextStop,
  onPrevStop,
  totalDistanceKm,
  estMinutes,
}: RouteMapFrameProps) {
  const points = useMemo(() => layoutStopsOnRoute(stops.length), [stops.length]);
  const start = driverStartPoint();
  const activeStop = activeIndex !== null ? stops[activeIndex] : null;
  const activePoint = activeIndex !== null ? points[activeIndex] : null;

  const { coords, loading: geoLoading } = useGeocode(
    activeStop?.address ?? "",
    navigating && !!activeStop?.address.trim(),
  );

  const fullPath = buildRoutePath(points);
  const legPath =
    activePoint && activeIndex !== null
      ? buildLegPath(activeIndex === 0 ? start : points[activeIndex - 1], activePoint)
      : "";

  const embedUrl = useMemo(() => {
    if (!coords) return null;
    const pad = 0.012;
    const bbox = [
      coords.lon - pad,
      coords.lat - pad,
      coords.lon + pad,
      coords.lat + pad,
    ].join("%2C");
    const marker = `${coords.lat}%2C${coords.lon}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
  }, [coords]);

  return (
    <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100 shadow-inner">
      {navigating && embedUrl ? (
        <iframe
          title="Navigation map"
          src={embedUrl}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          aria-label="Route overview"
        >
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={VIEW_W} height={VIEW_H} fill="url(#grid)" />

          {!navigating && fullPath && (
            <path d={fullPath} fill="none" stroke="#00B5AD" strokeWidth="4" strokeLinecap="round" />
          )}

          {navigating && legPath && (
            <>
              <path
                d={legPath}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="3"
                strokeDasharray="8 6"
                strokeLinecap="round"
              />
              <path
                d={legPath}
                fill="none"
                stroke="#00B5AD"
                strokeWidth="5"
                strokeLinecap="round"
                className="animate-pulse"
              />
            </>
          )}

          {navigating && (
            <g>
              <circle cx={start.x} cy={start.y} r="10" fill="#64748b" />
              <text x={start.x} y={start.y + 22} textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="bold">
                YOU
              </text>
            </g>
          )}

          {stops.map((s, i) => {
            const p = points[i];
            const isActive = activeIndex === i;
            const isPast = activeIndex !== null && i < activeIndex;
            return (
              <StopMarker
                key={s.order_id}
                point={p}
                number={s.stop_number}
                active={isActive}
                past={isPast}
              />
            );
          })}
        </svg>
      )}

      {navigating && activeStop && (
        <div className="absolute left-3 right-3 top-3 rounded-xl bg-navy/95 p-3 text-white shadow-lg backdrop-blur-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Navigating · Stop {activeStop.stop_number} of {stops.length}
              </p>
              <p className="truncate font-bold">{activeStop.customer_name}</p>
              <p className="mt-1 flex items-start gap-1 text-xs text-white/90">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-2">
                  {activeStop.address.trim() || "Address not set — use order details"}
                </span>
              </p>
              {geoLoading && (
                <p className="mt-1 text-[10px] text-white/60">Loading map…</p>
              )}
            </div>
            <button
              type="button"
              onClick={onCloseNavigation}
              className="rounded-lg p-1 hover:bg-white/10"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={activeIndex === 0}
              onClick={onPrevStop}
              className="flex-1 rounded-lg bg-white/15 py-2 text-xs font-semibold disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={activeIndex === stops.length - 1}
              onClick={onNextStop}
              className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Next stop
            </button>
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 flex justify-around rounded-xl bg-white/95 p-3 text-center text-sm shadow-lg backdrop-blur">
        <div>
          <p className="text-muted">Total Distance</p>
          <p className="font-bold text-navy">{totalDistanceKm ?? "—"} km</p>
        </div>
        <div>
          <p className="text-muted">Stops</p>
          <p className="font-bold text-navy">{stops.length}</p>
        </div>
        <div>
          <p className="text-muted">Est. Time</p>
          <p className="font-bold text-navy">{estMinutes ?? 0} min</p>
        </div>
      </div>

    </div>
  );
}

function StopMarker({
  point,
  number,
  active,
  past,
}: {
  point: MapPoint;
  number: number;
  active: boolean;
  past: boolean;
}) {
  const r = active ? 20 : 16;
  const fill = active ? "#00B5AD" : past ? "#22c55e" : "#0F172A";
  return (
    <g>
      {active && (
        <circle cx={point.x} cy={point.y} r={r + 6} fill="#00B5AD" opacity={0.25} />
      )}
      <circle cx={point.x} cy={point.y} r={r} fill={fill} stroke={active ? "#fff" : "none"} strokeWidth={2} />
      <text
        x={point.x}
        y={point.y + 4}
        textAnchor="middle"
        fill="white"
        fontSize={active ? 13 : 12}
        fontWeight="bold"
      >
        {number}
      </text>
    </g>
  );
}
