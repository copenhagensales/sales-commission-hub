/**
 * Midlertidig helper for cancellation-matching (Stork 1.x).
 *
 * Når Stork 2.0 sektion 6 (Identitet) leverer en central
 * identity-resolver (SQL-funktion + hook), skal denne fil slettes
 * og erstattes. Den er stillads, ikke fundament.
 *
 * Steder der bruger denne helper i dag:
 * - src/components/cancellations/UploadCancellationsTab.tsx
 * - src/components/cancellations/LocateSaleDialog.tsx
 * - src/components/cancellations/MatchErrorsSubTab.tsx
 *
 * Princip 9: Ren funktion uden Supabase-kald. Caller henter data,
 * helperen transformerer.
 */

export interface BuildEmployeeEmailIndexArgs {
  employees: {
    id: string;
    work_email: string | null;
    private_email: string | null;
  }[];
  mappings: { employee_id: string; agent_id: string }[];
  agents: { id: string; email: string | null }[];
}

/**
 * Bygger et opslag fra employee_id → Set af alle kendte (lowercased) emails
 * for den medarbejder: work_email, private_email og enhver agent.email
 * tilknyttet via employee_agent_mapping.
 *
 * - NULL/empty/whitespace-emails springes over.
 * - Inaktive medarbejdere og inaktive agents bevares (historisk attribution).
 * - Medarbejdere uden nogen valide emails udelades fra Map.
 */
export function buildEmployeeEmailIndex(
  args: BuildEmployeeEmailIndexArgs,
): Map<string, Set<string>> {
  const { employees, mappings, agents } = args;

  // agent.id → normaliseret email
  const agentIdToEmail = new Map<string, string>();
  for (const a of agents) {
    const normalized = normalizeEmail(a.email);
    if (normalized) agentIdToEmail.set(a.id, normalized);
  }

  // employee_id → Set<agent.email>
  const employeeIdToAgentEmails = new Map<string, Set<string>>();
  for (const m of mappings) {
    const email = agentIdToEmail.get(m.agent_id);
    if (!email) continue;
    let set = employeeIdToAgentEmails.get(m.employee_id);
    if (!set) {
      set = new Set<string>();
      employeeIdToAgentEmails.set(m.employee_id, set);
    }
    set.add(email);
  }

  const result = new Map<string, Set<string>>();
  for (const emp of employees) {
    const set = new Set<string>();

    const work = normalizeEmail(emp.work_email);
    if (work) set.add(work);

    const priv = normalizeEmail(emp.private_email);
    if (priv) set.add(priv);

    const agentEmails = employeeIdToAgentEmails.get(emp.id);
    if (agentEmails) {
      for (const e of agentEmails) set.add(e);
    }

    if (set.size > 0) result.set(emp.id, set);
  }

  return result;
}

function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}
