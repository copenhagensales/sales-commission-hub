import { Samleside } from "@/components/layout/Samleside";
import { useMitArbejdeSynlighed } from "@/hooks/useMitArbejdeSynlighed";
import {
  MySchedule, MyBookingSchedule, TimeStamp, TastSelvSalg, ImmediatePaymentASE,
  VagtSalesRegistration, CommissionLeague, HeadToHead,
} from "@/routes/pages";

export function VagterSamleside() {
  const { vagter } = useMitArbejdeSynlighed();
  return (
    <Samleside
      titel="Vagter"
      faner={[
        { id: "vagtplan", label: "Min vagtplan", element: vagter.vagtplanFm ? <MyBookingSchedule /> : <MySchedule />, synlig: vagter.vagtplanFm || vagter.vagtplanTm },
        // Bruger med både FM- og TM-vagtplan ser begge.
        { id: "vagtplan-tm", label: "Min vagtplan (TM)", element: <MySchedule />, synlig: vagter.vagtplanFm && vagter.vagtplanTm },
        { id: "stempelur", label: "Stempelur", element: <TimeStamp />, synlig: vagter.stempelur },
      ]}
    />
  );
}

export function RegistrerSalgSamleside() {
  const { salg } = useMitArbejdeSynlighed();
  return (
    <Samleside
      titel="Registrér salg"
      faner={[
        { id: "salg", label: "Salg", element: <TastSelvSalg />, synlig: salg.salg },
        { id: "straksbetaling", label: "Straksbetaling", element: <ImmediatePaymentASE />, synlig: salg.straksbetaling },
        { id: "fm", label: "Salgsregistrering", element: <VagtSalesRegistration />, synlig: salg.fm },
      ]}
    />
  );
}

export function SpilSamleside() {
  const { spil } = useMitArbejdeSynlighed();
  return (
    <Samleside
      titel="Spil"
      faner={[
        { id: "superligaen", label: "Superligaen", element: <CommissionLeague />, synlig: spil.superligaen },
        { id: "head2head", label: "Head2Head", element: <HeadToHead />, synlig: spil.head2head },
      ]}
    />
  );
}
