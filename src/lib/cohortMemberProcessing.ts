import { supabase } from "@/integrations/supabase/client";
import { ensureTeamMembership } from "@/lib/employees/ensureTeamMembership";

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
    // 1. Create employee record with daily_bonus_client_id
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

    // 1b. Team membership (team_members is the authoritative source of truth —
    // employee_master_data.team_id above is only the planned team)
    if (cohort.team_id) {
      await ensureTeamMembership({ employeeId: employee.id, teamId: cohort.team_id });
    }

    // 2. Link cohort_members row back to the new employee
    const { error: memberError } = await supabase
      .from("cohort_members")
      .update({ employee_id: employee.id, status: "confirmed" })
      .eq("id", member.id);
    if (memberError) throw memberError;

    // 3. Opret brugeradgang på arbejdsmailen + send velkomstmail
    //    (erstatter det gamle link-baserede invitationsflow, som SSO gjorde ubrugeligt)
    const activation = await activateEmployeeAccount({
      employeeId: employee.id,
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
          .insert({ employee_id: employee.id, agent_id: agentId })
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
