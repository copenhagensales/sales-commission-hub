import { Samleside } from "@/components/layout/Samleside";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useSalgRapporterSynlighed } from "@/hooks/useSalgRapporterSynlighed";
import { isTvMode } from "@/utils/tvMode";
import {
  VagtFlowIndex, VagtBookingManagement, VagtBilling, VagtEesyFmDeviations, VagtLocations,
  TdcErhvervEditSales, TrygEditSales, VagtEditSalesRegistrations,
  FiberRegistrering, TdcIdriftsaettelse, TdcOpsummering, MgTest, CustomerInquiries,
  ReportsAdmin, ReportsManagement, DailyReports, RevenueByClient, WeeklyLeadClosureReport, Cancellations,
  PowerdagBoard, PowerdagInput, PowerdagAdmin,
} from "@/routes/pages";

/** Booking-fanen læser selv ?tab= (underfane), derfor vælges fanen her med ?fane=. */
export function FieldmarketingSamleside() {
  const s = useSalgRapporterSynlighed().fieldmarketing;
  return (
    <Samleside titel="Fieldmarketing" parameter="fane" vedTab="booking" faner={[
      { id: "vagt-flow", label: "Overblik", element: <VagtFlowIndex />, synlig: s["vagt-flow"] },
      { id: "booking", label: "Booking", element: <VagtBookingManagement />, synlig: s.booking },
      { id: "billing", label: "Fakturering", element: <VagtBilling />, synlig: s.billing },
      { id: "eesy-fm-deviations", label: "Afvigelser", element: <VagtEesyFmDeviations />, synlig: s["eesy-fm-deviations"] },
      { id: "locations", label: "Steder", element: <VagtLocations />, synlig: s.locations },
    ]} />
  );
}

export function RetSalgSamleside() {
  const s = useSalgRapporterSynlighed().retSalg;
  return (
    <Samleside titel="Ret salg" faner={[
      { id: "tdc-erhverv-edit-sales", label: "TDC Erhverv", element: <TdcErhvervEditSales />, synlig: s["tdc-erhverv-edit-sales"] },
      { id: "tryg-edit-sales", label: "Tryg", element: <TrygEditSales />, synlig: s["tryg-edit-sales"] },
      { id: "edit-sales", label: "Fieldmarketing", element: <VagtEditSalesRegistrations />, synlig: s["edit-sales"] },
    ]} />
  );
}

export function TdcSamleside() {
  const s = useSalgRapporterSynlighed().tdc;
  return (
    <Samleside titel="TDC-værktøjer" faner={[
      { id: "fiber-registrering", label: "Fiber", element: <FiberRegistrering />, synlig: s["fiber-registrering"] },
      { id: "tdc-idriftsaettelse", label: "Idriftsættelse", element: <TdcIdriftsaettelse />, synlig: s["tdc-idriftsaettelse"] },
      { id: "tdc-opsummering", label: "Opsummering", element: <TdcOpsummering />, synlig: s["tdc-opsummering"] },
    ]} />
  );
}

export function KunderOgPriserSamleside() {
  const s = useSalgRapporterSynlighed().kunder;
  return (
    <Samleside titel="Kunder og priser" faner={[
      { id: "mg-test", label: "Kunder og priser", element: <MgTest />, synlig: s["mg-test"] },
      { id: "henvendelser", label: "Henvendelser", element: <CustomerInquiries />, synlig: s.henvendelser },
    ]} />
  );
}

export function RapporterSamleside() {
  const s = useSalgRapporterSynlighed().rapporter;
  return (
    <Samleside titel="Rapporter" faner={[
      { id: "admin", label: "Overblik", element: <ReportsAdmin />, synlig: s.admin },
      { id: "management", label: "Ledelsesrapport", element: <ReportsManagement />, synlig: s.management },
      { id: "daily", label: "Dagsrapporter", element: <DailyReports />, synlig: s.daily },
      { id: "revenue-by-client", label: "Omsætning pr. opgave", element: <RevenueByClient />, synlig: s["revenue-by-client"] },
      { id: "weekly-lead-closure", label: "Tryg-kampagner", element: <WeeklyLeadClosureReport />, synlig: s["weekly-lead-closure"] },
      { id: "cancellations", label: "Annulleringer", element: <Cancellations />, synlig: s.cancellations },
    ]} />
  );
}

export function PowerdagSamleside() {
  const s = useSalgRapporterSynlighed().powerdag;
  // TV-visning af tavlen forbliver uændret (ingen faner/menu).
  // menu_dashboard_powerdag gælder også her; TV-login har sin egen rute.
  if (isTvMode() && s.powerdag) return <PowerdagBoard />;
  return (
    <Samleside titel="Powerdag" layout={DashboardLayout} faner={[
      { id: "powerdag", label: "Tavle", element: <PowerdagBoard />, synlig: s.powerdag },
      { id: "input", label: "Input", element: <PowerdagInput />, synlig: s.input },
      { id: "admin", label: "Administration", element: <PowerdagAdmin />, synlig: s.admin },
    ]} />
  );
}
