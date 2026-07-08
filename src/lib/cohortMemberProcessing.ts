import { supabase } from "@/integrations/supabase/client";

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
export async function processCohortMember(
  member: ProcessableCohortMember,
  cohort: CohortContext,
  results: ProcessResults
): Promise<void> {
  const candidate = member.candidate;

  if (!candidate.email) {
    results.skipped++;
    results.errors.push(`${candidate.first_name} ${candidate.last_name} mangler email`);
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
        employment_start_date: cohort.start_date,
        team_id: cohort.team_id,
        is_active: true,
        invitation_status: "pending",
        daily_bonus_client_id: member.daily_bonus_client_id,
      })
      .select()
      .single();

    if (empError) throw empError;

    // 2. Link cohort_members row back to the new employee
    const { error: memberError } = await supabase
      .from("cohort_members")
      .update({ employee_id: employee.id, status: "confirmed" })
      .eq("id", member.id);
    if (memberError) throw memberError;

    // 3. Send invitation email
    const { error: inviteError } = await supabase.functions.invoke(
      "send-employee-invitation",
      {
        body: {
          employeeId: employee.id,
          email: candidate.email,
          firstName: candidate.first_name,
          lastName: candidate.last_name,
        },
      }
    );
    if (inviteError) throw inviteError;

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
