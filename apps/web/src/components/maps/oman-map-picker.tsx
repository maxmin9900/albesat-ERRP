"use client";

import {
  OMAN_BOUNDS,
  OMAN_CENTER,
  OMAN_LOCATION_ERROR,
  resolveOmanLocation,
  searchAddressOman,
} from "@/lib/oman-geo";
import { MapLinkPaste } from "@/components/maps/map-link-paste";
import { cn } from "@/lib/utils";
import { MapPin, Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import "leaflet/dist/leaflet.css";

const MapInner = dynamic(() => import("./oman-map-inner"), { ssr: false });

export interface MapLocation {
  lat: number;
  lng: number;
  address?: string;
}

interface OmanMapPickerProps {
  value: MapLocation | null;
  onChange: (loc: MapLocation) => void;
  className?: string;
  height?: string;
  /** Show the "paste WhatsApp location" input (staff only — it calls the API). */
  linkPaste?: boolean;
}

export function OmanMapPicker({
  value,
  onChange,
  className,
  height = "280px",
  linkPaste = false,
}: OmanMapPickerProps) {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<{ lat: number; lng: number; label: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState(0);

  const position = value ?? OMAN_CENTER;

  const handlePositionChange = useCallback(
    async (lat: number, lng: number): Promise<string | null> => {
      setGeocoding(true);
      setError(null);
      const resolved = await resolveOmanLocation(lat, lng);
      setGeocoding(false);
      if (!resolved) {
        setError(OMAN_LOCATION_ERROR);
        return OMAN_LOCATION_ERROR;
      }
      onChange(resolved);
      return null;
    },
    [onChange],
  );

  useEffect(() => {
    if (search.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const results = await searchAddressOman(search);
      setSuggestions(results);
      setSearching(false);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className={cn("space-y-3", className)}>
      {linkPaste && (
        <MapLinkPaste
          onResolved={async (lat, lng) => {
            const err = await handlePositionChange(lat, lng);
            // On failure the message is shown under the paste input instead.
            if (err) setError(null);
            else setFocusKey((k) => k + 1);
            return err;
          }}
        />
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Search address in Oman..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-border bg-white shadow-lg">
            {suggestions.map((s) => (
              <li key={`${s.lat}-${s.lng}`}>
                <button
                  type="button"
                  className="w-full px-4 py-2 text-left text-sm hover:bg-surface-alt"
                  onClick={() => {
                    setSearch(s.label);
                    setSuggestions([]);
                    void handlePositionChange(s.lat, s.lng);
                  }}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {searching && <p className="mt-1 text-xs text-muted">Searching...</p>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border" style={{ height }}>
        <MapInner
          lat={position.lat}
          lng={position.lng}
          bounds={OMAN_BOUNDS}
          onPositionChange={(lat, lng) => void handlePositionChange(lat, lng)}
          focusKey={focusKey}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {value && (
        <div className="flex items-start gap-2 rounded-xl bg-primary/5 px-3 py-2 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="font-mono text-xs text-muted" dir="ltr">
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
              {geocoding && " — resolving address..."}
            </p>
            {value.address && <p className="mt-0.5 text-navy">{value.address}</p>}
          </div>
        </div>
      )}

      <p className="text-xs text-muted">
        Drag the pin to set the exact pickup location (Oman only).
      </p>
    </div>
  );
}
