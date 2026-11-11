"use client";

import { needsHttpsForLiveCamera, redirectHttpIpToHttps } from "@/lib/secure-ip";
import { useEffect } from "react";

/**
 * Phones block live camera on http://IP. Redirect to https://IP automatically
 * (same IP — one-time browser security warning, then live scan works).
 */
export function HttpsIpRedirect() {
  useEffect(() => {
    if (needsHttpsForLiveCamera()) {
      redirectHttpIpToHttps();
    }
  }, []);

  return null;
}
