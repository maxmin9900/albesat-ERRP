/** Geographic bounds for Sultanate of Oman (map panning / coarse filter). */
export const OMAN_BOUNDS = {
  south: 16.65,
  west: 52.05,
  north: 26.4,
  east: 59.85,
} as const;

export const OMAN_CENTER = { lat: 23.588, lng: 58.3829 } as const;

export function isInsideOman(lat: number, lng: number): boolean {
  return (
    lat >= OMAN_BOUNDS.south &&
    lat <= OMAN_BOUNDS.north &&
    lng >= OMAN_BOUNDS.west &&
    lng <= OMAN_BOUNDS.east
  );
}

export interface GeocodeAtResult {
  address: string | null;
  countryCode: string | null;
}

/** Reverse geocode a point and return the detected country (no country filter on request). */
export async function reverseGeocodeAt(lat: number, lng: number): Promise<GeocodeAtResult> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "json");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("accept-language", "en");
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "AlbesatCarpetPro/1.0" },
    });
    if (!res.ok) return { address: null, countryCode: null };
    const data = (await res.json()) as {
      display_name?: string;
      address?: { country_code?: string };
    };
    return {
      address: data.display_name ?? null,
      countryCode: data.address?.country_code?.toLowerCase() ?? null,
    };
  } catch {
    return { address: null, countryCode: null };
  }
}

export interface OmanLocationResult {
  lat: number;
  lng: number;
  address: string;
}

/** Validate coordinates are inside Oman using map bounds + Nominatim country check.
 *
 * Nominatim is a free service that rate-limits and can simply be unreachable.
 * A failed lookup returns no country, which must not be read as "not Oman" —
 * that rejected valid Muscat pins whenever the lookup was throttled. So the
 * bounds decide, and the geocoder only overrules them when it positively
 * names a different country.
 */
export async function resolveOmanLocation(
  lat: number,
  lng: number,
): Promise<OmanLocationResult | null> {
  if (!isInsideOman(lat, lng)) return null;

  const geo = await reverseGeocodeAt(lat, lng);
  if (geo.countryCode && geo.countryCode !== "om") return null;

  return {
    lat,
    lng,
    address: geo.address ?? `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  };
}

/** @deprecated Use reverseGeocodeAt / resolveOmanLocation */
export async function reverseGeocodeOman(lat: number, lng: number): Promise<string | null> {
  const resolved = await resolveOmanLocation(lat, lng);
  return resolved?.address ?? null;
}

export async function searchAddressOman(query: string): Promise<
  { lat: number; lng: number; label: string }[]
> {
  if (query.trim().length < 3) return [];
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "json");
    url.searchParams.set("q", query);
    url.searchParams.set("countrycodes", "om");
    url.searchParams.set("limit", "8");
    url.searchParams.set("accept-language", "en");
    url.searchParams.set("bounded", "1");
    url.searchParams.set(
      "viewbox",
      `${OMAN_BOUNDS.west},${OMAN_BOUNDS.south},${OMAN_BOUNDS.east},${OMAN_BOUNDS.north}`,
    );
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "AlbesatCarpetPro/1.0" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
      address?: { country_code?: string };
    }[];
    return data
      .map((r) => ({
        lat: Number(r.lat),
        lng: Number(r.lon),
        label: r.display_name,
        countryCode: r.address?.country_code?.toLowerCase() ?? "om",
      }))
      .filter((r) => r.countryCode === "om" && isInsideOman(r.lat, r.lng))
      .map(({ lat, lng, label }) => ({ lat, lng, label }));
  } catch {
    return [];
  }
}

export const OMAN_LOCATION_ERROR = "Location must be inside Oman. Select a point within Oman only.";
