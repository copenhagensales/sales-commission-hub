/**
 * Fælles opslag af profilbillede ud fra medarbejder-id eller navn.
 * Genbruger useEmployeeAvatars - ingen ekstra forespørgsler.
 */
import { useCallback } from "react";
import { useEmployeeAvatars } from "@/hooks/useEmployeeAvatars";

export function useAvatarLookup(options?: { enabled?: boolean }) {
  const { data } = useEmployeeAvatars(options);

  return useCallback(
    (input: { employeeId?: string | null; name?: string | null }): string | null => {
      if (!data) return null;
      if (input.employeeId) {
        const byId = data.idToAvatarMap.get(input.employeeId);
        if (byId) return byId;
      }
      if (input.name) {
        return data.avatarMap.get(input.name.trim().toLowerCase()) ?? null;
      }
      return null;
    },
    [data]
  );
}
