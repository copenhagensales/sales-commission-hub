/**
 * Client ID mapping utility for pre-computed KPI lookups.
 * Maps client names to their database IDs.
 */

export const CLIENT_IDS: Record<string, string> = {
  // TM (Telesales) clients
  "Eesy": "81993a7b-ff24-46b8-8ffb-37a83138ddba",
  "Eesy TM": "81993a7b-ff24-46b8-8ffb-37a83138ddba",
  "TDC Erhverv": "20744525-7466-4b2c-afa7-6ee09a9112b0",
  "Relatel": "0ff8476d-16d8-4150-aee9-48ac90ec962d",
  "Tryg": "516a3f67-ea6d-4ef0-929d-e3224cc16e22",
  "Yousee": "5011a7cd-bf07-4838-a63f-55a12c604b40",
  "CODAN": "789f7e51-d3c8-42c6-b461-b45ea20d1e1f",
  "Ase": "53eb9c4a-91b0-44a9-9ee7-a87d87cc3e0f",
  "AKA": "67a9ed3e-0a35-4ba1-bc2e-8baca2da9d07",
  "Finansforbundet": "ae556b33-276a-41d6-ab3d-b6752b201eb0",
  "Business DK": "a1386026-d01a-46ae-88ca-a120cc5789c0",
  "A&Til": "ff77fd2a-6aa3-4275-bbb0-291e692ab389",
  // FM (Fieldmarketing) clients
  "Eesy FM": "9a92ea4c-6404-4b58-be08-065e7552d552",
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
