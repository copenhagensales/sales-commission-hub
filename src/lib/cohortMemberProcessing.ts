import { supabase } from "@/integrations/supabase/client";
import { ensureTeamMembership } from "@/lib/employees/ensureTeamMembership";
import { findExistingEmployeeByEmail } from "@/lib/employees/findExistingEmployeeByEmail";

export interface ProcessableCohortMember {
  id: string;
  daily_bonus_client_id: string | null;
  agent_email: string | null;
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    applied_position: string | null;
    email: string | null;
    phone: string | null;
  };
}

export interface CohortContext {
  id: string;
  team_id: string | null;
  start_date: string | null;
}

export interface ProcessResults {
  sent: number;
  skipped: number;
  errors: string[];
}

/**
 * Processes a single cohort member: creates the employee_master_data row,
 * links it back to the cohort_members row, sends the invitation email,
 * updates the candidate status, and creates the agent + mapping if needed.
 *
 * Shared between the "Start hold og send invitationer" flow and the
 * late-add flow (AddMemberDialog on an already-started cohort) so both
 * paths follow the exact same activation logic (Bibel §8 — single source).
 */
export interface ActivationOverrides {
  /** Copenhagensales-mail der bruges som arbejdsmail og login. Falder tilbage til agent_email. */
  workEmail?: string | null;
  /** Startdato der overstyrer holdets startdato. */
  startDate?: string | null;
}

/**
 * Opretter/genbruger brugeradgangen på arbejdsmailen og sender velkomstmailen.
 * Login sker via Microsoft, så brugeren skal findes på præcis arbejdsmailen.
 */
export async function activateEmployeeAccount(params: {
  employeeId: string;
  workEmail: string;
  privateEmail?: string | null;
  firstName: string;
  lastName?: string | null;
  startDate?: string | null;
}): Promise<{ mailSent: boolean; mailError: string | null }> {
  const { data, error } = await supabase.functions.invoke("activate-employee-account", {
    body: {
      employeeId: params.employeeId,
      workEmail: params.workEmail,
      privateEmail: params.privateEmail ?? null,
      firstName: params.firstName,
      lastName: params.lastName ?? "",
      startDate: params.startDate ?? null,
    },
  });
  if (error) throw error;
  const result = (data ?? {}) as { mailSent?: boolean; mailError?: string | null };
  return { mailSent: !!result.mailSent, mailError: result.mailError ?? null };
}

export async function processCohortMember(
  member: ProcessableCohortMember,
  cohort: CohortContext,
  results: ProcessResults,
  overrides: ActivationOverrides = {},
): Promise<void> {
  const candidate = member.candidate;

  if (!candidate.email) {
    results.skipped++;
    results.errors.push(`${candidate.first_name} ${candidate.last_name} mangler email`);
    return;
  }

  const workEmail = (overrides.workEmail ?? member.agent_email ?? "").trim().toLowerCase();
  const startDate = overrides.startDate ?? cohort.start_date;

  if (!workEmail) {
    results.skipped++;
    results.errors.push(
      `${candidate.first_name} ${candidate.last_name} mangler Copenhagensales-mail`,
    );
    return;
  }

  try {
    // 1. Genbrug et eksisterende stamkort hvis medarbejderen allerede findes.
    //    Databasen har en dublet-spærring (trg_prevent_duplicate_employee), så et
    //    blindt insert fejler for folk der allerede er oprettet manuelt.
    const existing = await findExistingEmployeeByEmail(workEmail, candidate.email);

    let employeeId: string;

    if (existing) {
      // Udfyld KUN tomme felter — eksisterende data må ikke overskrives.
      const { data: current, error: currentErr } = await supabase
        .from("employee_master_data")
        .select(
          "id, is_active, job_title, private_phone, private_email, employment_start_date, daily_bonus_client_id",
        )
        .eq("id", existing.id)
        .single();
      if (currentErr) throw currentErr;

      const patch: Record<string, unknown> = {};
      if (!current.is_active) patch.is_active = true;
      if (!current.job_title && candidate.applied_position) {
        patch.job_title = candidate.applied_position;
      }
      if (!current.private_phone && candidate.phone) patch.private_phone = candidate.phone;
      if (!current.private_email && candidate.email) patch.private_email = candidate.email;
      if (!current.employment_start_date && startDate) {
        patch.employment_start_date = startDate;
      }
      if (!current.daily_bonus_client_id && member.daily_bonus_client_id) {
        patch.daily_bonus_client_id = member.daily_bonus_client_id;
      }

      if (Object.keys(patch).length > 0) {
        const { error: patchErr } = await supabase
          .from("employee_master_data")
          .update(patch)
          .eq("id", current.id);
        if (patchErr) throw patchErr;
      }

      employeeId = current.id;
    } else {
      const { data: employee, error: empError } = await supabase
        .from("employee_master_data")
        .insert({
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          private_email: candidate.email,
          private_phone: candidate.phone,
          job_title: candidate.applied_position,
          employment_start_date: startDate,
          team_id: cohort.team_id,
          is_active: true,
          invitation_status: "pending",
          daily_bonus_client_id: member.daily_bonus_client_id,
        })
        .select()
        .single();

      if (empError) throw empError;
      employeeId = employee.id;
    }

    // 1b. Team membership (team_members is the authoritative source of truth —
    // employee_master_data.team_id above is only the planned team)
    if (cohort.team_id) {
      await ensureTeamMembership({ employeeId, teamId: cohort.team_id });
    }


    // 2. Link cohort_members row back to the new employee
    const { error: memberError } = await supabase
      .from("cohort_members")
      .update({ employee_id: employeeId, status: "confirmed" })
      .eq("id", member.id);
    if (memberError) throw memberError;

    // 3. Opret brugeradgang på arbejdsmailen + send velkomstmail
    //    (erstatter det gamle link-baserede invitationsflow, som SSO gjorde ubrugeligt)
    const activation = await activateEmployeeAccount({
      employeeId,
      workEmail,
      privateEmail: candidate.email,
      firstName: candidate.first_name,
      lastName: candidate.last_name,
      startDate,
    });
    if (!activation.mailSent && activation.mailError) {
      results.errors.push(
        `${candidate.first_name}: bruger oprettet, men velkomstmail fejlede (${activation.mailError})`,
      );
    }


    // 4. Update candidate status
    const { error: candError } = await supabase
      .from("candidates")
      .update({ status: "onboarding", cohort_assignment_status: "started" })
      .eq("id", candidate.id);
    if (candError) throw candError;

    // 5. Create agent + mapping if agent_email is set (non-fatal)
    if (member.agent_email) {
      try {
        const email = member.agent_email.toLowerCase();
        const { data: existingAgent } = await supabase
          .from("agents")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        let agentId: string;
        if (existingAgent) {
          agentId = existingAgent.id;
        } else {
          const { data: newAgent, error: agentError } = await supabase
            .from("agents")
            .insert({
              email,
              name: `${candidate.first_name} ${candidate.last_name}`,
              is_active: true,
              source: "cohort_onboarding",
            })
            .select()
            .single();
          if (agentError) throw agentError;
          agentId = newAgent.id;
        }

        const { error: mappingError } = await supabase
          .from("employee_agent_mapping")
          .insert({ employee_id: employeeId, agent_id: agentId })
          .select()
          .single();
        if (mappingError && !mappingError.message.includes("duplicate")) {
          console.error("Agent mapping error:", mappingError);
        }
      } catch (agentErr) {
        console.error("Agent creation error:", agentErr);
        // Don't fail the whole process for agent mapping
      }
    }

    results.sent++;
  } catch (err: any) {
    results.errors.push(`Fejl ved ${candidate.first_name}: ${err.message}`);
  }
}
