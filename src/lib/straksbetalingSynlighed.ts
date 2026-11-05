/** Fanen Straksbetaling: ledere med "se alle" ser den altid; øvrige kræver fanerettighed + egne straks-salg. */
export function straksbetalingSynlig(fane: boolean, seAlle: boolean, harEgneSalg: boolean): boolean {
  return seAlle || (fane && harEgneSalg);
}
