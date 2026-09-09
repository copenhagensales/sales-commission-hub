import { MainLayout } from "@/components/layout/MainLayout";
import {
  ComplianceDocument,
  DocSection,
  DocSubSection,
  
} from "@/components/compliance/ComplianceDocument";

export default function ProcessingRegistry() {
  return (
    <MainLayout>
      <ComplianceDocument
        title="Fortegnelse over behandlingsaktiviteter (GDPR art. 30) og risikovurdering — Stork"
        version="1.0"
        documentDate="9. september 2026"
        statusLabel="GODKENDT - 9. september 2026 af Mathias Dandanel Grubak og Lone Mikkelsen"
        statusTone="approved"
      >
        <DocSection heading="A. Dataansvarlig">
          <p>
            Copenhagen Sales ApS, CVR 35890513, Vesterbrogade 149, 1620 København
            V. Kontakt: direktionen (Kasper Mikkelsen, Mathias Dandanel Grubak).
            Systemejer: Lone Mikkelsen.
          </p>
        </DocSection>

        <DocSection heading="B. Roller">
          <p>
            Copenhagen Sales er <strong>dataansvarlig</strong> for medarbejder- og
            rekrutteringsdata og <strong>databehandler</strong> for kundedata, der
            behandles på vegne af klienter.
          </p>
          <p>
            Klientkampagner registreret i systemet: TDC Erhverv, Relatel, Tryg,
            ALKA, AKA, Ase, Codan, Eesy TM, Eesy FM, Yousee, Hiper,
            Finansforbundet, Business DK, Just Eat, A&amp;Til.
          </p>
        </DocSection>

        <DocSection heading="C. Behandlingsaktiviteter">
          <DocSubSection heading="Løn- og provisionsberegning">
            <p>
              <strong>Formål:</strong> Beregning og udbetaling af løn, provision
              og bonus samt dokumentation af arbejdstid.
            </p>
            <p>
              <strong>Registrerede:</strong> Ansatte medarbejdere.
            </p>
            <p>
              <strong>Datakategorier:</strong> Stamdata, løn, provision og
              tidsregistrering. Løn er kun registreret ét sted (stamkortet) og er
              kun synlig for superadmin — håndhævet i databasen med RLS.
            </p>
            <p>
              <strong>Opbevaring:</strong> Aktive ansættelser + 5 år efter
              fratrædelse (aktiv politik: 1.825 dage, anonymisering).
            </p>
          </DocSubSection>

          <DocSubSection heading="Salgsafregning for klienter">
            <p>
              <strong>Formål:</strong> Afregning og dokumentation af salg over for
              klienter, herunder håndtering af annulleringer og reklamationer.
            </p>
            <p>
              <strong>Registrerede:</strong> Kunder hos klienterne.
            </p>
            <p>
              <strong>Datakategorier:</strong> Pr. salg gemmes ét
              kundetelefonnummer (til annullerings-/reklamationsmatch) samt
              provisionsnøglerne. Der gemmes ingen kundenavne, adresser eller
              e-mails — kolonnerne findes ikke i systemet.
            </p>
            <p>
              <strong>Opbevaring:</strong> Styres pr. klientkampagne via{" "}
              <code>campaign_retention_policies</code>. Status pr. i dag: 23
              politikker er oprettet, men <strong>ingen er aktiveret</strong>.
              Perioder pr. klient afventer fastlæggelse og krydstjek mod
              databehandleraftaler.
            </p>
          </DocSubSection>

          <DocSubSection heading="Rekruttering">
            <p>
              <strong>Formål:</strong> Behandling af jobansøgninger og
              rekrutteringsforløb.
            </p>
            <p>
              <strong>Registrerede:</strong> Ansøgere og kandidater.
            </p>
            <p>
              <strong>Opbevaring:</strong> Jobansøgninger 355 dage
              (anonymisering — aktiv politik). Rekrutteringskommunikation 365 dage
              (anonymisering — aktiv politik). Statistik som antal ansøgere og
              kilder bevares, mens personhenførbare oplysninger fjernes.
            </p>
          </DocSubSection>

          <DocSubSection heading="Drift og sikkerhed">
            <p>
              <strong>Formål:</strong> Driftsstabilitet, fejlsøgning,
              adgangskontrol og sikkerhedsopfølgning.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Login-historik: 365 dage (anonymisering — aktiv politik).</li>
              <li>Integrationslogge: 180 dage (fuld sletning — aktiv politik).</li>
              <li>Kundehenvendelser: 90 dage (anonymisering — aktiv politik).</li>
              <li>
                Password reset tokens: 35 dage (fuld sletning — aktiv politik).
                Password-login er i øvrigt nedlagt 9/9-2026.
              </li>
              <li>
                Adgangslog for følsomme opslag:{" "}
                <code>sensitive_data_access_log</code>.
              </li>
            </ul>
          </DocSubSection>
        </DocSection>

        <DocSection heading="D. Modtagere og databehandlere">
          <p className="text-muted-foreground">
            Aftalegrundlag, links og arkiveringsstatus pr. leverandør fremgår af
            dokumentet{" "}
            <a
              href="/compliance/documents/dpa-overview"
              className="text-primary underline"
            >
              Databehandleraftaler (DPA) — oversigt og status
            </a>
            .
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              Lovable — udviklings- og driftsplatform. Se DPA-oversigten; status:
              aktiveret.
            </li>
            <li>
              Supabase — hosting, database og auth. Region: eu-west-3 (Paris, EU),
              aflæst i projektets forbindelsesopsætning. Se DPA-oversigten; status:
              mangler arkivering.
            </li>
            <li>
              Microsoft (Entra ID / Microsoft 365) — login samt udsendelse af mail
              og kalenderopslag via Graph. Se DPA-oversigten; status: mangler
              arkivering.
            </li>
            <li>
              Adversus — dialer/kampagneintegration. Se DPA-oversigten; status:
              mangler arkivering (tjek onboarding-dokumenter / rekvirér).
            </li>
            <li>
              Enreach — dialer/telefoniintegration. Se DPA-oversigten; status:
              mangler arkivering (tjek onboarding-dokumenter).
            </li>
            <li>
              Twilio — SMS og telefoni. Se DPA-oversigten; status: mangler
              arkivering.
            </li>
            <li>
              e-conomic — økonomi og bogføring. Se DPA-oversigten; status: mangler
              arkivering.
            </li>
          </ul>
          <p className="text-muted-foreground">
            Databehandleraftalerne arkiveres som PDF direkte i DPA-oversigten med
            angivelse af arkiveringsdato. Filerne ligger i et lukket arkiv, hvor
            kun ejere og superadmins kan uploade, åbne og slette dem. Status pr.
            leverandør opdateres i DPA-oversigten, når aftalen er arkiveret.
          </p>
        </DocSection>

        <DocSection heading="E. Sikkerhedsforanstaltninger (art. 32)">
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>
              Microsoft-only login via Entra ID. Password-login er teknisk
              nedlagt 9/9-2026 i brugerfladen, i endpoints og i
              auth-konfigurationen.
            </li>
            <li>Rollebaseret adgang håndhævet med Row Level Security (RLS).</li>
            <li>
              Superadmin-model håndhævet i databasen: kun 3 navngivne personer kan
              se løn- og DB-tal.
            </li>
            <li>Adgangslogning af følsomme opslag (CPR, bank, kontrakter).</li>
            <li>
              Audit-spor for kontosammenlægninger (<code>auth_account_merge_log</code>).
            </li>
            <li>
              GDPR-cleanup-log (<code>gdpr_cleanup_log</code>) over sletninger og
              anonymiseringer.
            </li>
            <li>
              Note-strip-filter ved al indlæsning: fritekstnoter afvises ved
              kilden (implementeret 8/9-2026).
            </li>
            <li>
              Dagligt automatiseret sletnings- og anonymiseringsjob kl. 03:30
              (UTC).
            </li>
          </ul>
        </DocSection>

        <DocSection heading="F. Risikovurdering og åbne punkter">
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>
              Kampagne-retention for kundedata er oprettet (23 politikker) men
              ikke aktiveret — afventer perioder pr. klient og krydstjek mod
              databehandleraftaler.
            </li>
            <li>
              Backup-retention er dokumenteret i separat politik: se
              “Backup- og gendannelsespolitik (GDPR)”.
            </li>
            <li>Databehandleraftaler skal samles ét sted.</li>
            <li>
              Planlagt LLM-baseret bedømmelse af medarbejdertests kræver
              dokumenteret vurdering før idriftsættelse.
            </li>
            <li>
              Feltet <code>customer_company</code> vurderes for
              personhenførbarhed (enkeltmandsvirksomheder) og indarbejdes i
              positivlisten.
            </li>
            <li>
              Offboarding: når en medarbejder stopper, deaktiveres
              Entra-kontoen, og Stork-adgangen ophører automatisk, fordi login
              udelukkende sker via Microsoft.
            </li>
          </ol>
        </DocSection>

        <DocSection heading="G. Revision">
          <p>
            Dokumentet gennemgås halvårligt af direktionen og systemejer.
          </p>
        </DocSection>
      </ComplianceDocument>
    </MainLayout>
  );
}
