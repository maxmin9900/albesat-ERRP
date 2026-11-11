"use client";

import { Button } from "@/components/ui/button";
import { useAdminUsers, useSetUserActive, useUpdateUserRoles } from "@/lib/api/users-hooks";
import { ROLE_LABELS } from "@/lib/auth-roles";
import { usePermissions } from "@/lib/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ASSIGNABLE_ROLE_SLUGS = new Set([
  "admin",
  "operation_team",
  "driver",
  "finance_team",
  "repair_team",
  "super_admin",
]);

function roleLabel(slug: string): string {
  return ROLE_LABELS[slug] ?? slug.replace(/_/g, " ");
}

export default function UsersPage() {
  const router = useRouter();
  const { has } = usePermissions();
  const canManageUsers = has("users:manage");
  const { data, isLoading } = useAdminUsers();
  const updateRoles = useUpdateUserRoles();
  const setActive = useSetUserActive();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageUsers) {
      router.replace("/admin");
    }
  }, [canManageUsers, router]);

  if (!canManageUsers) {
    return <p className="text-muted">Redirecting...</p>;
  }

  const startEdit = (userId: string, roles: string[]) => {
    setEditingId(userId);
    setSelectedRoles(roles.filter((r) => ASSIGNABLE_ROLE_SLUGS.has(r)));
    setSaveError(null);
  };

  const saveRoles = async (userId: string) => {
    if (selectedRoles.length === 0) {
      setSaveError("Select at least one role.");
      return;
    }
    if (selectedRoles.includes("admin") && selectedRoles.includes("super_admin")) {
      setSaveError("Choose either Admin or System Manager — not both on the same account.");
      return;
    }
    setSaveError(null);
    try {
      await updateRoles.mutateAsync({ userId, role_slugs: selectedRoles });
      setEditingId(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to update roles");
    }
  };

  const toggleRole = (slug: string) => {
    setSelectedRoles((prev) => {
      if (prev.includes(slug)) {
        return prev.filter((r) => r !== slug);
      }
      // Admin and System Manager are mutually exclusive (US-4).
      if (slug === "admin") {
        return [...prev.filter((r) => r !== "super_admin"), slug];
      }
      if (slug === "super_admin") {
        return [...prev.filter((r) => r !== "admin"), slug];
      }
      return [...prev, slug];
    });
  };

  if (isLoading) {
    return <p className="text-muted">Loading users...</p>;
  }

  const roles = (data?.roles ?? []).filter((r) => ASSIGNABLE_ROLE_SLUGS.has(r.slug));

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Users & Roles</h1>
      <p className="mt-1 text-muted">
        Assign staff roles only. <strong>Admin</strong> and <strong>System Manager</strong> are separate
        roles — remove System Manager if the user should be Admin only.
      </p>
      {saveError ? <p className="mt-3 text-sm text-danger">{saveError}</p> : null}

      <div className="mt-8 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted">
              <th className="p-4">Name</th>
              <th className="p-4">Phone</th>
              <th className="p-4">Roles</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-border/60">
                <td className="p-4 font-semibold text-navy">{u.full_name}</td>
                <td className="p-4">{u.phone}</td>
                <td className="p-4">
                  {editingId === u.id ? (
                    <div className="flex flex-wrap gap-2">
                      {roles.map((r) => (
                        <button
                          key={r.slug}
                          type="button"
                          onClick={() => toggleRole(r.slug)}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium",
                            selectedRoles.includes(r.slug)
                              ? "bg-primary text-white"
                              : "bg-surface-alt text-muted",
                          )}
                        >
                          {roleLabel(r.slug)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span key={r} className="rounded-full bg-surface-alt px-2 py-0.5 text-xs">
                          {roleLabel(r)}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      u.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800",
                    )}
                  >
                    {u.is_active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {editingId === u.id ? (
                      <>
                        <Button size="sm" onClick={() => saveRoles(u.id)} loading={updateRoles.isPending}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => startEdit(u.id, u.roles)}>
                          Edit roles
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActive.mutate({ userId: u.id, is_active: !u.is_active })}
                        >
                          {u.is_active ? "Disable" : "Enable"}
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
