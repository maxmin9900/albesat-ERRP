import type { RoleInfo } from "@/lib/stores/auth";

/** Staff roles shown on the admin portal role picker (excludes customer). */
export const STAFF_ROLE_SLUGS = [
  "super_admin",
  "admin",
  "operation_team",
  "repair_team",
  "finance_team",
  "driver",
] as const;

const ROLE_ORDER: Record<string, number> = {
  super_admin: 0,
  admin: 1,
  finance_team: 2,
  operation_team: 3,
  repair_team: 4,
  driver: 5,
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "System Manager",
  admin: "Admin",
  operation_team: "Operations",
  repair_team: "Repair Team",
  finance_team: "Finance & CRM",
  driver: "Driver",
};

export function staffRoles(roles: RoleInfo[]): RoleInfo[] {
  return roles
    .filter((r) => r.slug !== "customer")
    .sort((a, b) => (ROLE_ORDER[a.slug] ?? 99) - (ROLE_ORDER[b.slug] ?? 99));
}
