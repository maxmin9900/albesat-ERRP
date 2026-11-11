"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Legacy role picker — role is determined by the access code at /login */
export default function RoleSelectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
