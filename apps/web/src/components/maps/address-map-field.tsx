"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { MapLinkPaste } from "@/components/maps/map-link-paste";
import { MapLocation, OmanMapPicker } from "@/components/maps/oman-map-picker";
import { isInsideOman, OMAN_LOCATION_ERROR, resolveOmanLocation } from "@/lib/oman-geo";
import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

interface AddressMapFieldProps {
  value: string;
  onChange: (address: string) => void;
  location?: MapLocation | null;
  onLocationChange?: (location: MapLocation | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  rows?: number;
  id?: string;
  /** Show the "paste WhatsApp location" input (staff only — it calls the API). */
  linkPaste?: boolean;
}

export function AddressMapField({
  value,
  onChange,
  location = null,
  onLocationChange,
  label = "Pickup Address",
  placeholder = "Street, building, city — or pick on map",
  error,
  rows = 3,
  id,
  linkPaste = false,
}: AddressMapFieldProps) {
  const [mapOpen, setMapOpen] = useState(false);
  const [draft, setDraft] = useState<MapLocation | null>(location);
  const [mapError, setMapError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (mapOpen) {
      setDraft(location);
      setMapError(null);
    }
  }, [mapOpen, location]);

  const applyPastedLocation = async (lat: number, lng: number) => {
    const resolved = await resolveOmanLocation(lat, lng);
    if (!resolved) return OMAN_LOCATION_ERROR;
    onChange(resolved.address);
    onLocationChange?.(resolved);
    return null;
  };

  const confirmSelection = async () => {
    if (!draft) return;
    setConfirming(true);
    setMapError(null);
    const resolved = await resolveOmanLocation(draft.lat, draft.lng);
    setConfirming(false);
    if (!resolved) {
      setMapError(OMAN_LOCATION_ERROR);
      return;
    }
    onChange(resolved.address);
    onLocationChange?.(resolved);
    setMapOpen(false);
  };

  return (
    <>
      <div>
        {label && (
          <label htmlFor={id} className="mb-2 block text-sm font-semibold text-navy">
            {label}
          </label>
        )}
        <div className="flex gap-2">
          <textarea
            id={id}
            rows={rows}
            className="min-h-[80px] flex-1 rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              if (location) onLocationChange?.(null);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0 self-start"
            onClick={() => setMapOpen(true)}
            aria-label="Pick address on map"
          >
            <MapPin className="h-4 w-4" /> Pin
          </Button>
        </div>
        {linkPaste && <MapLinkPaste className="mt-2" onResolved={applyPastedLocation} />}
        {linkPaste && location && (
          <p className="mt-1 flex items-center gap-1 font-mono text-xs text-muted" dir="ltr">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
          </p>
        )}
        {(error || (location && !isInsideOman(location.lat, location.lng))) && (
          <p className="mt-1 text-xs text-danger">{error ?? OMAN_LOCATION_ERROR}</p>
        )}
      </div>

      <Modal
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        title="Pick pickup location (Oman)"
        dialogClassName="max-w-2xl"
      >
        <div className="space-y-4">
          <OmanMapPicker value={draft} onChange={setDraft} height="360px" linkPaste={linkPaste} />
          {mapError && <p className="text-sm text-danger">{mapError}</p>}
          <div className="flex gap-3 border-t border-border pt-4">
            <Button
              type="button"
              className="flex-1"
              disabled={!draft || confirming}
              loading={confirming}
              onClick={() => void confirmSelection()}
            >
              Use this address
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMapOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
