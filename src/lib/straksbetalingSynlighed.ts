/** Fanen Straksbetaling: ledere med "se alle" ser den altid; øvrige kræver fanerettighed + primær kundetilknytning til ASE (United). */
export function straksbetalingSynlig(fane: boolean, seAlle: boolean, erUnitedSaelger: boolean): boolean {
  return seAlle || (fane && erUnitedSaelger);
}
