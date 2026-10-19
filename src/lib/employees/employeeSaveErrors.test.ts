import { describe, it, expect } from "vitest";
import { describeEmployeeSaveError } from "./employeeSaveErrors";

describe("describeEmployeeSaveError", () => {
  it("læser kort-id fra databasens dublet-hint", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const r = describeEmployeeSaveError({ code: "P0001", message: "Arbejdsmailen findes allerede", hint: `duplicate_work_email:${id}` });
    expect(r.existingEmployeeId).toBe(id);
  });
  it("oversætter aktivt arbejdsmail-indeks", () => {
    const r = describeEmployeeSaveError({ code: "23505", message: 'duplicate key value violates unique constraint "employee_master_data_active_work_email_uniq"' });
    expect(r.message).toContain("ét aktivt kort");
  });
  it("oversætter aktivt login-indeks", () => {
    const r = describeEmployeeSaveError({ code: "23505", message: 'violates unique constraint "employee_master_data_active_auth_user_uniq"' });
    expect(r.message).toContain("Login-kontoen");
  });
});
