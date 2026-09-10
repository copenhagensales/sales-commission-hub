// Fælles M365 Graph-afsendelse med valgfri vedhæftning.
export interface MailAttachment {
  name: string;
  contentType: string;
  contentBytes: string; // base64
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function getGraphToken(): Promise<string> {
  const tenantId = Deno.env.get("M365_TENANT_ID");
  const clientId = Deno.env.get("M365_CLIENT_ID");
  const clientSecret = Deno.env.get("M365_CLIENT_SECRET");
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("M365-konfiguration mangler");
  }
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }).toString(),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`M365 token-fejl: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

export async function sendM365Mail(params: {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}): Promise<void> {
  const senderEmail = Deno.env.get("M365_SENDER_EMAIL");
  if (!senderEmail) throw new Error("M365_SENDER_EMAIL mangler");
  const token = await getGraphToken();

  const message: Record<string, unknown> = {
    subject: params.subject,
    body: { contentType: "HTML", content: params.html },
    toRecipients: params.to.map((address) => ({ emailAddress: { address } })),
  };
  if (params.cc?.length) {
    message.ccRecipients = params.cc.map((address) => ({ emailAddress: { address } }));
  }
  if (params.attachments?.length) {
    message.attachments = params.attachments.map((a) => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.name,
      contentType: a.contentType,
      contentBytes: a.contentBytes,
    }));
  }

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    },
  );
  if (!res.ok) {
    throw new Error(`M365 sendMail-fejl: ${await res.text()}`);
  }
}
