// Browserbase: EU-region, persistent context pr. login. Sessioner er keepAlive, så de kan
// overleve, mens ejeren taster en engangskode i Live View. Optagelse (replay) er slået til.
import { PortalError } from "./invoiceflowPortalPeriods.ts";

export const BROWSERBASE_REGION = "eu-central-1";
/** Sessionen dør selv efter 20 min – længere end ventetiden på 15 min. */
export const SESSION_TIMEOUT_S = 1200;
const API = "https://api.browserbase.com/v1";

function cfg() {
  const key = Deno.env.get("BROWSERBASE_API_KEY");
  const projectId = Deno.env.get("BROWSERBASE_PROJECT_ID");
  if (!key || !projectId) throw new PortalError("BROWSERBASE", "Browserbase er ikke sat op (secrets mangler)");
  return { key, projectId };
}

async function call(path: string, init: RequestInit = {}) {
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
      keepAlive: true,
      timeout: SESSION_TIMEOUT_S,
      browserSettings: { context: { id: contextId, persist: true }, recordSession: true, logSession: false },
    }),
  });
  return { id: s.id, connectUrl: s.connectUrl, region: s.region ?? BROWSERBASE_REGION };
}

/** Forbindelses-URL til en kørende session (til genoptagelse efter engangskode). */
export async function sessionConnectUrl(id: string): Promise<string> {
  const s = await call(`/sessions/${id}`);
  if (s.status && s.status !== "RUNNING") throw new PortalError("PORTAL_CODE_TIMEOUT", "Browsersessionen er lukket");
  return s.connectUrl ?? `wss://connect.browserbase.com?apiKey=${cfg().key}&sessionId=${id}`;
}

/** Live View hentes frisk ved hvert kald og gemmes aldrig. */
export async function liveViewUrl(id: string): Promise<string> {
  const d = await call(`/sessions/${id}/debug`);
  const url = d.debuggerFullscreenUrl ?? d.debuggerUrl;
  if (!url) throw new PortalError("BROWSERBASE", "Live View er ikke tilgængelig");
  return url as string;
}

export async function releaseSession(id: string) {
  try {
    const { projectId } = cfg();
    await call(`/sessions/${id}`, { method: "POST", body: JSON.stringify({ projectId, status: "REQUEST_RELEASE" }) });
  } catch { /* sessionen udløber selv efter timeout */ }
}
