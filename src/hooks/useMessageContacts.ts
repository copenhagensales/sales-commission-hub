import { useQuery } from "@tanstack/react-query";
import { fetchAllRows } from "@/utils/supabasePagination";

export interface MessageCandidate {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  applied_position: string | null;
}

export interface MessageEmployee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  private_phone: string | null;
}

/** Alle kandidater (pagineret forbi 1000-rækkers grænsen) til navneopslag i Beskeder. */
export function useMessageCandidates() {
  return useQuery({
    queryKey: ["message-candidates"],
    queryFn: () =>
      fetchAllRows<MessageCandidate>(
        "candidates",
        "id, first_name, last_name, phone, email, applied_position",
        undefined,
        { orderBy: "id", pageSize: 1000 }
      ),
    staleTime: 60_000,
  });
}

/** Medarbejdere med telefonnummer – fallback-navn når nummeret ikke er en kandidat. */
export function useMessageEmployees() {
  return useQuery({
    queryKey: ["message-employees"],
    queryFn: () =>
      fetchAllRows<MessageEmployee>(
        "employee_master_data",
        "id, first_name, last_name, private_phone",
        (q) => q.not("private_phone", "is", null),
        { orderBy: "id", pageSize: 1000 }
      ),
    staleTime: 5 * 60_000,
  });
}

export const last8 = (v: string | null | undefined) => (v || "").replace(/\D/g, "").slice(-8);
