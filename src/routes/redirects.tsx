import { Navigate, useLocation, useSearchParams } from "react-router-dom";

/** Fjernede sider (oprydning 26/10): gamle links og bogmærker sendes videre i stedet for 404. */
const redirectCache = new Map<string, () => JSX.Element>();
export function redirectTo(to: string) {
  let c = redirectCache.get(to);
  if (!c) {
    c = function RedirectKeepQuery() {
      const { search } = useLocation();
      // Bevar den gamle query-streng; mål-parametre (fx tab=) lægges til/vinder.
      const [path, targetQuery = ""] = to.split("?");
      const merged = new URLSearchParams(search);
      new URLSearchParams(targetQuery).forEach((v, k) => merged.set(k, v));
      const q = merged.toString();
      return <Navigate to={`${path}${q ? `?${q}` : ""}`} replace />;
    };
    redirectCache.set(to, c);
  }
  return c;
}

// Redirect components for consolidated menu items
// These redirect old routes to the new consolidated location in MyProfile

/** Pulsen hedder nu Storkbook – gamle links bevarer query (fx ?post=). */
export function PulsenRedirect() {
  const [params] = useSearchParams();
  const q = params.toString();
  return <Navigate to={`/storkbook${q ? `?${q}` : ""}`} replace />;
}

export const MyScheduleRedirect = redirectTo("/my-profile?tab=kalender");

export function MyGoalsRedirect() {
  return <Navigate to="/my-profile?tab=maal" replace />;
}

export const MyContractsRedirect = redirectTo("/my-profile?tab=kontrakter");

export const CareerWishesRedirect = redirectTo("/my-profile?tab=karriere");
