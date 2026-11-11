import { isInsideOman } from "@/lib/oman-geo";

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function openMapsUrl(url: string): void {
  if (isMobileDevice()) {
    window.location.assign(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Open navigation to exact map pin (lat/lng from customer map selection). */
export function openMapsNavigationCoords(lat: number, lng: number): void {
  const dest = `${lat},${lng}`;
  const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`;
  openMapsUrl(url);
}

function normalizeAddressQuery(address: string): string {
  const q = address.trim();
  if (!/\boman\b/i.test(q)) {
    return `${q}, Oman`;
  }
  return q;
}

/** Open turn-by-turn navigation using address text (fallback when no coordinates). */
export function openMapsNavigation(address: string): void {
  const q = normalizeAddressQuery(address);
  if (!q) {
    window.alert("No address available for this stop.");
    return;
  }
  const encoded = encodeURIComponent(q);
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
  openMapsUrl(url);
}

/**
 * Open Google Maps to the customer's pickup point.
 * Uses saved lat/lng from map selection (exact pin). Falls back to address text.
 */
export function openMapsNavigationTo(
  address: string | null | undefined,
  lat?: string | number | null,
  lng?: string | number | null,
): void {
  const latNum = lat != null ? Number(lat) : NaN;
  const lngNum = lng != null ? Number(lng) : NaN;
  const hasCoords = !Number.isNaN(latNum) && !Number.isNaN(lngNum) && isInsideOman(latNum, lngNum);

  if (hasCoords) {
    openMapsNavigationCoords(latNum, lngNum);
    return;
  }
  if (address?.trim()) {
    openMapsNavigation(address);
    return;
  }
  window.alert("No location available for this stop.");
}

/** Open a multi-stop route: first stops as waypoints, last as destination. */
export function openMapsRoute(addresses: string[]): void {
  const stops = addresses.map((a) => a.trim()).filter(Boolean);
  if (stops.length === 0) {
    window.alert("No addresses on this route.");
    return;
  }
  if (stops.length === 1) {
    openMapsNavigation(stops[0]);
    return;
  }
  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1).join("|");
  const url = `https://www.google.com/maps/dir/?api=1&waypoints=${encodeURIComponent(waypoints)}&destination=${encodeURIComponent(normalizeAddressQuery(destination))}`;
  openMapsUrl(url);
}
