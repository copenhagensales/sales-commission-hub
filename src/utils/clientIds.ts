/**
 * Client ID mapping utility for pre-computed KPI lookups.
 * Maps client names to their database IDs.
 */

export const CLIENT_IDS: Record<string, string> = {
  "Eesy": "81993a7b-ff24-46b8-8ffb-37a83138ddba",
  "TDC Erhverv": "20744525-7466-4b2c-afa7-6ee09a9112b0",
  "Relatel": "0ff8476d-16d8-4150-aee9-48ac90ec962d",
  "Tryg": "f65db2f9-80c5-4b12-b0e4-c5f2ff9ca56b",
  "Yousee": "14a5ff0c-1f82-4c56-b6ab-f9f3e14bdf5f",
  "United": "c9a9c8f9-9c4d-4d7c-9e1e-8f8e8e8e8e8e",
  "Buurtzorg": "1f5efbf1-4bca-42df-8fa9-e0cb1f6f9d5e",
};

/**
 * Get the client ID for a given client name.
 * Returns undefined if client is not found.
 */
export function getClientId(clientName: string): string | undefined {
  return CLIENT_IDS[clientName];
}

/**
 * Get the client name for a given client ID.
 * Returns undefined if client is not found.
 */
export function getClientName(clientId: string): string | undefined {
  return Object.entries(CLIENT_IDS).find(([_, id]) => id === clientId)?.[0];
}
