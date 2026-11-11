import {
  readAuthSnapshot,
  type AuthSnapshot,
} from "@/lib/auth-flow";
import { useAuthStore } from "@/lib/stores/auth";

export type { AuthSnapshot };
export { readAuthSnapshot };

export function bootstrapAuthFromSnapshot(): boolean {
  const snap = readAuthSnapshot();
  if (!snap?.accessToken) return false;
  if (useAuthStore.getState().accessToken) return true;
  useAuthStore.setState({
    accessToken: snap.accessToken,
    refreshToken: snap.refreshToken,
    user: snap.user,
    selectedRole: snap.selectedRole,
    displayPhone: snap.displayPhone ?? snap.user.phone,
    sessionToken: null,
    availableRoles: [],
  });
  return true;
}
