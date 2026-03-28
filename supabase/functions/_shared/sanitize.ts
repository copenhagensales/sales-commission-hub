/**
 * PII Sanitization Helpers for Edge Function Logging
 * Masks sensitive data in console.log output without affecting data processing.
 */

const PII_KEYS = new Set([
  'email', 'phone', 'from', 'to', 'body',
  'first_name', 'last_name', 'firstName', 'lastName',
  'From', 'To', 'Body', 'customer_phone', 'agent_email',
  'private_email', 'work_email',
]);

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '(empty)';
  const s = String(phone);
  if (s.length <= 4) return '****';
  return s.slice(0, s.length - 4).replace(/\d/g, '*') + s.slice(-4);
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '(empty)';
  const s = String(email);
  const atIndex = s.indexOf('@');
  if (atIndex <= 1) return s[0] + '***' + s.slice(atIndex);
  return s[0] + '***' + s.slice(atIndex);
}

export function sanitizePayload(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizePayload);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (PII_KEYS.has(key) || PII_KEYS.has(lowerKey)) {
      if (typeof value === 'string') {
        if (lowerKey.includes('email')) {
          result[key] = maskEmail(value);
        } else if (lowerKey.includes('phone') || lowerKey === 'from' || lowerKey === 'to') {
          result[key] = maskPhone(value);
        } else if (lowerKey === 'body') {
          result[key] = value.length > 0 ? `[${value.length} chars]` : '(empty)';
        } else {
          // Names: show first char only
          result[key] = value.length > 0 ? value[0] + '***' : '(empty)';
        }
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizePayload(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Masks email in a log string, e.g. "Sending to john@test.dk" → "Sending to j***@test.dk" */
export function maskEmailInString(str: string): string {
  return str.replace(/[\w.+-]+@[\w.-]+\.\w+/g, (match) => maskEmail(match));
}
