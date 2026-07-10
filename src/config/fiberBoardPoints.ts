/**
 * Fiber-produkter på TDC Erhverv – point-værdier til boardet.
 * Se dashboard "TDC Erhverv – Overblik" (fiber-kolonner på leaderboards).
 * Justér satser eller tilføj nye fiber-produkter ved at redigere denne map.
 */
export const FIBER_BOARD_POINTS: Record<string, number> = {
  "ed0ea287-4e34-417a-98fc-de4e9aecc3bc": 0.5, // Lukket salg HAP
  "c63708fc-2f10-42a8-82dc-2728979908d9": 1.0, // Fuldt salg HAP
  "e63c9da4-3862-49e6-97df-ce5ca9ecc2e6": 0.5, // Lead Provi HAP
  "34518fa2-0d01-41f5-9cf4-be8aeda803ff": 0.5, // Lukket salg VOK
  "25e393c0-95ea-4508-925e-0449c79cb023": 1.0, // Fuldt salg VOK
  "bd6ae50b-1516-4692-be9e-09b2317bf612": 0.5, // Lead Provi VOK
};

export const FIBER_PRODUCT_IDS = Object.keys(FIBER_BOARD_POINTS);
