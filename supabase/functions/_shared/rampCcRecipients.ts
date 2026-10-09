// deno-lint-ignore-file no-explicit-any
/**
 * Faste kopimodtagere paa Opstart-mails. Kilden er ramp_settings.cc_recipient_emails.
 * Navn og medarbejder-id slaas op paa work_email, saa mailen logges korrekt.
 */
export interface CcRecipient {
  email: string;
  name: string;
  employeeId: string | null;
}

export async function getRampCcRecipients(svc: any): Promise<CcRecipient[]> {
  const { data } = await svc.from("ramp_settings").select("cc_recipient_emails").limit(1).maybeSingle();
  const emails: string[] = ((data?.cc_recipient_emails ?? []) as string[])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return [];
  const { data: emps } = await svc
    .from("employee_master_data")
    .select("id, first_name, last_name, work_email")
    .in("work_email", emails);
  return emails.map((email) => {
    const e = (emps ?? []).find((x: any) => (x.work_email ?? "").toLowerCase() === email);
    return {
      email,
      name: e ? `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() : email,
      employeeId: e?.id ?? null,
    };
  });
}
