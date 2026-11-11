"use client";

import { Button } from "@/components/ui/button";
import { useAdminUsers, useSetUserActive, useUpdateUserRoles } from "@/lib/api/users-hooks";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function UsersPage() {
  const { data, isLoading } = useAdminUsers();
  const updateRoles = useUpdateUserRoles();
  const setActive = useSetUserActive();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const startEdit = (userId: string, roles: string[]) => {
    setEditingId(userId);
    setSelectedRoles(roles);
  };

  const saveRoles = async (userId: string) => {
    if (selectedRoles.length === 0) return;
    await updateRoles.mutateAsync({ userId, role_slugs: selectedRoles });
    setEditingId(null);
  };

  const toggleRole = (slug: string) => {
    setSelectedRoles((prev) =>
      prev.includes(slug) ? prev.filter((r) => r !== slug) : [...prev, slug],
    );
  };

  if (isLoading) {
    return <p className="text-muted">Loading users...</p>;
  }

  const roles = data?.roles ?? [];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy">Users & Roles</h1>
      <p className="mt-1 text-muted">Manage staff accounts and role assignments (US-3)</p>

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
                          {r.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span key={r} className="rounded-full bg-surface-alt px-2 py-0.5 text-xs capitalize">
                          {r.replace("_", " ")}
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
