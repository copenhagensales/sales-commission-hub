// Custom domain for the app
const CUSTOM_DOMAIN = 'https://provision.copenhagensales.dk';

/**
 * Get the public URL for the app.
 * Returns the custom domain when on preview, otherwise current origin.
 */
export function getPublicUrl(): string {
  const origin = window.location.origin;
  
  // If we're on the Lovable preview domain, use the custom domain
  if (origin.includes('.lovableproject.com') || origin.includes('.lovable.app')) {
    return CUSTOM_DOMAIN;
  }
  
  // Otherwise return current origin (custom domain)
  return origin;
}

/**
 * Get the TV board URL for a given access code
 */
export function getTvBoardUrl(code: string): string {
  return `${getPublicUrl()}/t/${code}`;
}
