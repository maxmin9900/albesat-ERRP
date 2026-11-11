"use client";

import { Button } from "@/components/ui/button";
import { useResolveMapLink } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { Check, Link2 } from "lucide-react";
import { useState } from "react";

interface MapLinkPasteProps {
  /** Apply the coordinates; return an error message to show, or null on success. */
  onResolved: (lat: number, lng: number) => Promise<string | null> | string | null;
  className?: string;
}

/**
 * Paste a location copied from WhatsApp (or Google / Apple Maps): a map link,
 * a short `maps.app.goo.gl` link, or plain `lat, lng`. The point is read by the
 * API and handed to the map, so the pin matches what the customer sent.
 */
export function MapLinkPaste({ onResolved, className }: MapLinkPasteProps) {
  const resolve = useResolveMapLink();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [applying, setApplying] = useState(false);

  const run = async (value: string) => {
    const input = value.trim();
    if (input.length < 3) return;
    setError(null);
    setApplied(false);
    setApplying(true);
    try {
      const loc = await resolve.mutateAsync(input);
      const err = await onResolved(loc.latitude, loc.longitude);
      if (err) setError(err);
      else setApplied(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this location");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            dir="ltr"
            placeholder="Paste WhatsApp location link or lat, lng"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setApplied(false);
              setError(null);
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (pasted.trim()) {
                e.preventDefault();
                setText(pasted.trim());
                void run(pasted);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void run(text);
              }
            }}
            className="w-full rounded-xl border border-border bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          loading={applying}
          disabled={applying || text.trim().length < 3}
          onClick={() => void run(text)}
        >
          Show on map
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {applied && !error && (
        <p className="flex items-center gap-1 text-xs font-semibold text-green-700">
          <Check className="h-3.5 w-3.5" /> Location placed on the map
        </p>
      )}
    </div>
  );
}
