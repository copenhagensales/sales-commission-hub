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
  "59f00afb-ce48-4da1-a21c-8fefa93eb11a": 0.5, // Lukket salg HAP (Inkl. Mobilevoice salg)
  "adc508fa-d2ba-4fe9-abe4-b0121cb0481f": 1.0, // Fuldt salg HAP (Inkl. Mobilevoice salg)
  "4ecf9122-5b57-497f-96b7-adbce0fb6652": 0.5, // Lead Provi HAP (Inkl. Mobilevoice salg)
  "7a792b7d-d5f7-40cf-86d4-12b8165b23e7": 0.5, // Lukket salg VOK (Inkl. Mobilevoice salg)
  "8d7b6403-28a2-40ee-9877-be42e60e0f36": 1.0, // Fuldt salg VOK (Inkl. Mobilevoice salg)
  "b0030dec-23b3-4cf8-9d88-0b4affe1312c": 0.5, // Lead Provi VOK (Inkl. Mobilevoice salg)
};

export const FIBER_PRODUCT_IDS = Object.keys(FIBER_BOARD_POINTS);

/**
 * Fiber-produkter der TÆLLES som fiber-salg i KPI-suffix "(+ N fiber)".
 * Ekskluderer "Lead Provi"-varianter — kun rigtige salg (Lukket/Fuldt HAP+VOK).
 */
export const FIBER_SALE_PRODUCT_IDS: string[] = [
  "ed0ea287-4e34-417a-98fc-de4e9aecc3bc", // Lukket salg HAP
  "c63708fc-2f10-42a8-82dc-2728979908d9", // Fuldt salg HAP
  "34518fa2-0d01-41f5-9cf4-be8aeda803ff", // Lukket salg VOK
  "25e393c0-95ea-4508-925e-0449c79cb023", // Fuldt salg VOK
  "59f00afb-ce48-4da1-a21c-8fefa93eb11a", // Lukket salg HAP (Inkl. Mobilevoice salg)
  "adc508fa-d2ba-4fe9-abe4-b0121cb0481f", // Fuldt salg HAP (Inkl. Mobilevoice salg)
  "7a792b7d-d5f7-40cf-86d4-12b8165b23e7", // Lukket salg VOK (Inkl. Mobilevoice salg)
  "8d7b6403-28a2-40ee-9877-be42e60e0f36", // Fuldt salg VOK (Inkl. Mobilevoice salg)
];
