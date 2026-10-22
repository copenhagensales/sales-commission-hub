import { Navigate, useSearchParams } from "react-router-dom";

// Redirect components for consolidated menu items
// These redirect old routes to the new consolidated location in MyProfile

/** Pulsen hedder nu Storkbook – gamle links bevarer query (fx ?post=). */
export function PulsenRedirect() {
  const [params] = useSearchParams();
  const q = params.toString();
  return <Navigate to={`/storkbook${q ? `?${q}` : ""}`} replace />;
}

export function PulsenDemoRedirect() {
  return <Navigate to="/storkbook/demo" replace />;
}

export function MyScheduleRedirect() {
  return <Navigate to="/my-profile?tab=kalender" replace />;
}

export function MyGoalsRedirect() {
  return <Navigate to="/my-profile?tab=maal" replace />;
}

export function MyContractsRedirect() {
  return <Navigate to="/my-profile?tab=kontrakter" replace />;
}

export function CareerWishesRedirect() {
  return <Navigate to="/my-profile?tab=karriere" replace />;
}
