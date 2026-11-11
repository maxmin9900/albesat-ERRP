"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Legacy OTP verify route — login is now a single step at /login */
export default function VerifyOtpPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
