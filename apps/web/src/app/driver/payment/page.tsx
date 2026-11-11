"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Payment was removed from the driver role — redirect to orders. */
export default function DriverPaymentRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/driver");
  }, [router]);
  return <p className="p-8 text-center text-muted">Redirecting...</p>;
}
