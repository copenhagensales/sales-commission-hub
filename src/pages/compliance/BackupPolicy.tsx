import { MainLayout } from "@/components/layout/MainLayout";
import {
  ComplianceDocument,
  DocSection,
} from "@/components/compliance/ComplianceDocument";

export default function BackupPolicy() {
  return (
    <MainLayout>
      <ComplianceDocument
        title="Backup- og gendannelsespolitik (GDPR)"
        version="1.0"
        documentDate="9. september 2026"
        statusLabel="GODKENDT — 9. september 2026 af Mathias Dandanel Grubak og Lone Mikkelsen"
      >
        <DocSection heading="1. Formål">
          <p>
            Stork anonymiserer persondata irreversibelt efter fastsatte
            opbevaringsperioder. Anonymisering er kun reel, hvis data heller ikke
            kan gendannes fra backups. Denne politik fastlægger derfor
            backup-retention og gendannelsesprocedure.
          </p>
        </DocSection>

        <DocSection heading="2. Backup-setup">
          <p>
            Stork kører på en hostet Postgres-database (Supabase) i regionen{" "}
            <strong>eu-west-3 (Paris, EU)</strong>, aflæst i projektets
            forbindelsesopsætning. Instansstørrelse: Large. Databasen er
            hostet-managed, og backup styres af platformen — ikke af Stork-koden.
          </p>
          <p>
            Backup styres af platformen (Supabase managed). Gendannelsesvinduet
            rækker maksimalt 14 dage tilbage - aflæst i Supabase-dashboardet 9.
            september 2026, hvor ældste gendannelsespunkt var 26. august 2026.
          </p>
        </DocSection>

        <DocSection heading="3. Politik">
          <p>
            Backups opbevares maksimalt 14 dage. Efter denne periode er
            anonymisering udført i Stork også effektiv i alle eksisterende
            backups, da ældre backups er roteret ud. Anonymisering anses derfor
            først for fuldt irreversibel 14 dage efter kørsel - dette er
            accepteret og dokumenteret. Bekræftet af Kasper Mikkelsen 9.
            september 2026.
          </p>
        </DocSection>


        <DocSection heading="4. Gendannelse">
          <p>
            Gendannelse fra backup må kun udføres af superadmin (Kasper
            Mikkelsen, Mathias Dandanel Grubak, Lone Mikkelsen) og kun ved
            kritisk datatab.
          </p>
          <p>
            Efter enhver gendannelse SKAL gdpr-cleanup-jobbet køres manuelt med
            det samme, så anonymiseringer udført efter backup-tidspunktet
            genanvendes.
          </p>
          <p>
            Enhver gendannelse dokumenteres i <code>gdpr_cleanup_log</code> eller
            tilsvarende med dato, årsag og hvem der udførte den.
          </p>
        </DocSection>

        <DocSection heading="5. Ansvar">
          <p>
            Systemejer Lone Mikkelsen påser årligt, at backup-indstillingerne
            stadig matcher denne politik.
          </p>
        </DocSection>
      </ComplianceDocument>
    </MainLayout>
  );
}
