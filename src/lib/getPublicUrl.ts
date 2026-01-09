/**
 * Get the public URL for the app.
 * In production, this returns the current origin.
 * In Lovable preview (lovableproject.com), this returns the published .lovable.app URL.
 */
export function getPublicUrl(): string {
  const origin = window.location.origin;
  
  // If we're on the Lovable preview domain, convert to published URL
  // Preview: https://[project-id].lovableproject.com
  // Published: https://[project-id].lovable.app
  if (origin.includes('.lovableproject.com')) {
    return origin.replace('.lovableproject.com', '.lovable.app');
  }
  
  // Otherwise return current origin (custom domain or published URL)
  return origin;
}

/**
 * Get the TV board URL for a given access code
 */
export function getTvBoardUrl(code: string): string {
  return `${getPublicUrl()}/t/${code}`;
}
