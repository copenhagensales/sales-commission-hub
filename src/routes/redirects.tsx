import { Navigate, useSearchParams } from "react-router-dom";

// Redirect components for consolidated menu items
// These redirect old routes to the new consolidated location in MyProfile

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
