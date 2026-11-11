/** Open turn-by-turn navigation in Google Maps (works on mobile and desktop). */
export function openMapsNavigation(address: string): void {
  const q = address?.trim();
  if (!q) {
    window.alert("No address available for this stop.");
    return;
  }
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
  window.open(url, "_blank", "noopener,noreferrer");
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
  const url = `https://www.google.com/maps/dir/?api=1&waypoints=${encodeURIComponent(waypoints)}&destination=${encodeURIComponent(destination)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
