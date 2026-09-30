/**
 * FM-produkter hvor sælgeren skal angive kurvnummer i stedet for telefonnummer.
 * Kun YouSee-fiberprodukterne på kampagnen "Yousee gaden" (identificeret på id,
 * så fiber på andre kunder/kampagner ikke rammes).
 */
export const FM_BASKET_NUMBER_PRODUCT_IDS: ReadonlySet<string> = new Set([
  "aff60b59-d602-4c2d-bcc5-3e3fb9ac5d72", // Fibernet Alm.
  "7582017c-249b-415d-be91-dace0039c9e4", // Fibernet Lead
  "758af7d2-fee7-477c-bad7-2c8a40485c70", // Fibernet Lead luk
]);

export const requiresBasketNumber = (productId: string): boolean =>
  FM_BASKET_NUMBER_PRODUCT_IDS.has(productId);
