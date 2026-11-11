import type { RoleInfo } from "@/lib/stores/auth";

/** Staff roles shown on the admin portal role picker (excludes customer). */
export const STAFF_ROLE_SLUGS = ["super_admin", "operation_team", "driver", "admin"] as const;

const ROLE_ORDER: Record<string, number> = {
  super_admin: 0,
  operation_team: 1,
  driver: 2,
  admin: 3,
};

export function staffRoles(roles: RoleInfo[]): RoleInfo[] {
  return roles
    .filter((r) => r.slug !== "customer")
    .sort((a, b) => (ROLE_ORDER[a.slug] ?? 99) - (ROLE_ORDER[b.slug] ?? 99));
}
