// Browserbase: EU-region, persistent context pr. login, ingen optagelse (logins må ikke ende i replays).
import { PortalError } from "./invoiceflowPortalPeriods.ts";

export const BROWSERBASE_REGION = "eu-central-1";
const API = "https://api.browserbase.com/v1";

function cfg() {
  const key = Deno.env.get("BROWSERBASE_API_KEY");
  const projectId = Deno.env.get("BROWSERBASE_PROJECT_ID");
  if (!key || !projectId) throw new PortalError("BROWSERBASE", "Browserbase er ikke sat op (secrets mangler)");
  return { key, projectId };
}

async function call(path: string, init: RequestInit) {
  const { key } = cfg();
  const r = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", "X-BB-API-Key": key, ...(init.headers ?? {}) } });
  if (!r.ok) throw new PortalError("BROWSERBASE", `Browserbase svarede ${r.status}`, r.status >= 500 || r.status === 429);
  return r.status === 204 ? null : r.json();
}

export async function createContext(): Promise<string> {
  const { projectId } = cfg();
  const c = await call("/contexts", { method: "POST", body: JSON.stringify({ projectId, region: BROWSERBASE_REGION }) });
  return c.id as string;
}

export async function createSession(contextId: string): Promise<{ id: string; connectUrl: string; region: string }> {
  const { projectId } = cfg();
  const s = await call("/sessions", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      region: BROWSERBASE_REGION,
      timeout: 300,
      browserSettings: { context: { id: contextId, persist: true }, recordSession: false, logSession: false },
    }),
  });
  return { id: s.id, connectUrl: s.connectUrl, region: s.region ?? BROWSERBASE_REGION };
}

export async function releaseSession(id: string) {
  const { projectId } = cfg();
  try {
    await call(`/sessions/${id}`, { method: "POST", body: JSON.stringify({ projectId, status: "REQUEST_RELEASE" }) });
  } catch { /* sessionen udløber selv efter timeout */ }
}
