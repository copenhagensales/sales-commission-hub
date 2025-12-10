import { WebhookParser, StandardWebhookPayload } from "./interface.ts";
import { AdversusWebhookParser } from "./adversus.ts";
import { EnreachWebhookParser } from "./enreach.ts";

// Registry of all available parsers
const parsers: { provider: string; parser: WebhookParser }[] = [
  { provider: "adversus", parser: new AdversusWebhookParser() },
  { provider: "enreach", parser: new EnreachWebhookParser() },
];

/**
 * Get parser by provider name
 */
export function getParserByProvider(provider: string): WebhookParser | null {
  const entry = parsers.find(p => p.provider === provider.toLowerCase());
  return entry?.parser || null;
}

/**
 * Auto-detect parser based on request content
 */
export function detectParser(
  rawBody: string, 
  contentType: string, 
  headers: Headers
): { provider: string; parser: WebhookParser } | null {
  for (const entry of parsers) {
    if (entry.parser.canHandle(rawBody, contentType, headers)) {
      console.log(`[WebhookFactory] Auto-detected provider: ${entry.provider}`);
      return entry;
    }
  }
  return null;
}

/**
 * Parse webhook using specified provider or auto-detect
 */
export function parseWebhook(
  rawBody: string,
  contentType: string,
  headers: Headers,
  providerHint?: string
): { provider: string; payload: StandardWebhookPayload } | null {
  
  // Try specific provider first
  if (providerHint) {
    const parser = getParserByProvider(providerHint);
    if (parser) {
      try {
        const payload = parser.parse(rawBody, contentType, headers);
        return { provider: providerHint, payload };
      } catch (e) {
        console.error(`[WebhookFactory] Parser ${providerHint} failed:`, e);
      }
    }
  }
  
  // Auto-detect
  const detected = detectParser(rawBody, contentType, headers);
  if (detected) {
    try {
      const payload = detected.parser.parse(rawBody, contentType, headers);
      return { provider: detected.provider, payload };
    } catch (e) {
      console.error(`[WebhookFactory] Auto-detected parser ${detected.provider} failed:`, e);
    }
  }
  
  return null;
}

export type { StandardWebhookPayload, StandardWebhookProduct } from "./interface.ts";
