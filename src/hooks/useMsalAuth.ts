import { useState, useCallback, useEffect, useRef } from "react";

// MSAL configuration - reads from env vars
const getMsalConfig = () => ({
  clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "",
  tenantId: import.meta.env.VITE_AZURE_TENANT_ID || "",
  redirectUri: import.meta.env.VITE_MS_REDIRECT_URI || window.location.origin,
});

const GRAPH_SCOPES = [
  "Calendars.ReadWrite",
  "Calendars.Read",
  "User.Read",
];

interface MsalAuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  userEmail: string | null;
}

/**
 * Hook for Microsoft Graph API authentication via MSAL.
 * Standalone — not connected to any flow yet.
 * Will use popup-based auth to get tokens for Graph API calls.
 */
export function useMsalAuth() {
  const [state, setState] = useState<MsalAuthState>({
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    userEmail: null,
  });

  const tokenExpiryRef = useRef<number | null>(null);

  const config = getMsalConfig();
  const isConfigured = Boolean(config.clientId && config.tenantId);

  // Acquire token via edge function (server-side token exchange)
  const acquireToken = useCallback(async (): Promise<string | null> => {
    if (!isConfigured) {
      setState(prev => ({ ...prev, error: "Microsoft 365 er ikke konfigureret" }));
      return null;
    }

    // Check if we have a valid cached token
    if (state.accessToken && tokenExpiryRef.current && Date.now() < tokenExpiryRef.current) {
      return state.accessToken;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // For now, use the edge function to get tokens
      // This will be connected to the actual MSAL flow later
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ms-graph-calendar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: "get-token" }),
        }
      );

      if (!response.ok) {
        throw new Error("Kunne ikke hente Microsoft token");
      }

      const data = await response.json();
      const token = data.accessToken;

      // Cache token for 50 minutes (tokens expire after 60)
      tokenExpiryRef.current = Date.now() + 50 * 60 * 1000;

      setState({
        accessToken: token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        userEmail: data.userEmail || null,
      });

      return token;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukendt fejl";
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      return null;
    }
  }, [isConfigured, state.accessToken]);

  // Call Graph API with auto-refresh
  const callGraphApi = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      let token = await acquireToken();
      if (!token) throw new Error("Ikke autentificeret med Microsoft 365");

      const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      // If 401, try refreshing token once
      if (response.status === 401) {
        tokenExpiryRef.current = null;
        token = await acquireToken();
        if (!token) throw new Error("Token-fornyelse fejlede");

        const retryResponse = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...options.headers,
          },
        });

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Graph API fejl: ${retryResponse.status}`);
        }

        return retryResponse.json();
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Graph API fejl: ${response.status}`);
      }

      return response.json();
    },
    [acquireToken]
  );

  return {
    ...state,
    isConfigured,
    acquireToken,
    callGraphApi,
    scopes: GRAPH_SCOPES,
  };
}
