/** Helpers for live camera on servers accessed by IP (requires HTTPS, not plain HTTP). */

export function isIpv4Host(hostname: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
}

export function needsHttpsForLiveCamera(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "http:" && isIpv4Host(window.location.hostname);
}

export function buildHttpsIpUrl(opts?: { camera?: boolean; preserveQuery?: boolean }): string {
  const { hostname, pathname, search, hash } = window.location;
  const params = opts?.preserveQuery !== false ? new URLSearchParams(search) : new URLSearchParams();
  if (opts?.camera) params.set("camera", "1");
  const qs = params.toString();
  return `https://${hostname}${pathname}${qs ? `?${qs}` : ""}${hash}`;
}

/** Redirect http://IP → https://IP (same address, secure context for getUserMedia). */
export function redirectHttpIpToHttps(opts?: { camera?: boolean }): boolean {
  if (!needsHttpsForLiveCamera()) return false;
  window.location.replace(buildHttpsIpUrl({ camera: opts?.camera, preserveQuery: true }));
  return true;
}

export function canUseLiveCamera(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}
