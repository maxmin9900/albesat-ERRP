"use client";

import { useEffect, useState } from "react";

/** Renders only on client to avoid hydration noise from env-based dev UI. */
export function DevLoginHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(process.env.NODE_ENV === "development");
  }, []);

  if (!show) return null;

  return (
    <p className="text-center text-xs text-muted">
      Demo: <span className="font-mono text-navy">+12125550147</span>
    </p>
  );
}
