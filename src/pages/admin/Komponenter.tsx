// D0: referenceside for designgrundlaget. Kun statiske eksempler – ingen data. Rute: /admin/komponenter (ikke i menuen).
import { useState } from "react";
import { Calendar, Target, Trophy, Wallet } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Afsnit, Faner, fanePanel, Felt, Fremdrift, Indtast, Kort, KortTitel, Liste, Noegletal, NoegletalRaekke, Pille, Raekke, Side, StortTal, TabelKort } from "@/components/cph";

const RAEKKER = [
  { id: "1", dato: "29. okt.", kunde: "Tryg", beloeb: "1.250 kr" },
  { id: "2", dato: "28. okt.", kunde: "YouSee", beloeb: "980 kr" },
  { id: "3", dato: "27. okt.", kunde: "ASE", beloeb: "2.100 kr" },
];

export default function Komponenter() {
  const [fane, setFane] = useState("maal");
  return (
    <MainLayout>
    <Side etiket="Designgrundlag · D0" titel="Komponenter" undertitel="Ét udtryk for hele Stork, hentet fra Hjem og Storkbook. Farverne er uændrede." ikon={<Wallet />}
      handlinger={<><Pille variant="sekundaer" ikon={<Calendar />}>Lønperiode</Pille><Pille>Gem</Pille></>}>
      <Afsnit titel="Eksempel: Mine tal">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Kort tone="moerk" className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <StortTal etiket="Provision denne periode" vaerdi="12.450 kr" note="Du har 7.550 kr tilbage til dit mål." />
              <Noegletal tone="moerk" etiket="Månedsmål" vaerdi="20.000 kr" note="62 % nået" fremhaev />
            </div>
            <Fremdrift tone="moerk" andel={62} etiket="Fremdrift mod mål" className="mt-8" />
            <div className="mt-6 flex flex-wrap gap-3">
              <Pille variant="lys">Se fremgang</Pille>
              <Pille variant="kontur" ikon={<Trophy />}>Tilmeld liga</Pille>
            </div>
          </Kort>
          <Kort>
            <KortTitel hoejre={<span className="text-[13px] text-muted-foreground">Snit 1.245 kr/dag</span>}>Seneste 10 dage</KortTitel>
            <div className="flex h-[120px] items-end gap-1.5">
              {[40, 65, 30, 80, 55, 20, 70, 90, 45, 60].map((h, i) => <div key={i} className="flex-1 rounded-t-md bg-[hsl(var(--cph-emerald))]" style={{ height: `${h}%` }} />)}
            </div>
            <p className="mt-3 text-[13px] text-muted-foreground">Bedste dag: tirsdag, 2.100 kr.</p>
          </Kort>
        </div>
        <NoegletalRaekke className="mt-4">
          <Noegletal etiket="Resterende" vaerdi="7.550 kr" note="12 dage" />
          <Noegletal etiket="Dagligt mål" vaerdi="630 kr" note="for at nå målet" />
          <Noegletal etiket="Din timeløn" vaerdi="212 kr/t" />
          <Noegletal etiket="Dage i træk" vaerdi="4" note="med salg" fremhaev />
        </NoegletalRaekke>
      </Afsnit>

      <Afsnit titel="Faner">
        <Faner etiket="Visning" praefiks="eks" vaerdi={fane} onSkift={setFane} punkter={[{ id: "maal", label: "Mål" }, { id: "loen", label: "Løn" }, { id: "historik", label: "Historik", taeller: 12 }]} />
        <div {...fanePanel("eks", fane)} className="mt-3 text-[14px] text-muted-foreground">Panel: {fane}</div>
      </Afsnit>

      <Afsnit titel="Knapper">
        <div className="flex flex-wrap gap-3">
          <Pille>Primær</Pille><Pille variant="sekundaer">Sekundær</Pille><Pille variant="lys">Lys</Pille><Pille variant="kontur">Kontur</Pille><Pille variant="fare">Slet</Pille>
          <Pille stoerrelse="lille">Lille</Pille><Pille variant="sekundaer" stoerrelse="lille" ikon={<Target />}>Med ikon</Pille><Pille disabled>Inaktiv</Pille>
        </div>
      </Afsnit>

      <Afsnit titel="Felter">
        <Kort>
          <div className="grid gap-4 md:grid-cols-2">
            <Felt id="maal" etiket="Dit mål for perioden" hjaelp="Beløb i kroner, før feriepenge."><Indtast id="maal" inputMode="numeric" placeholder="20.000" /></Felt>
            <Felt id="navn" etiket="Kundenavn" fejl="Kundenavn skal udfyldes."><Indtast id="navn" placeholder="Fx Tryg" aria-invalid /></Felt>
          </div>
        </Kort>
      </Afsnit>

      <Afsnit titel="Liste">
        <Liste etiket="Eksempelliste">
          <Raekke ikon={<Target />} titel="Mine tal" undertekst="Mål og løn for perioden" til="/my-goals" />
          <Raekke ikon={<Calendar />} titel="Vagter" undertekst="Næste vagt: i morgen 9–15" hoejre="3" onClick={() => undefined} />
          <Raekke ikon={<Trophy />} titel="Superligaen" undertekst="Plads 4 af 23" hoejre="1.980 p" />
        </Liste>
      </Afsnit>

      <Afsnit titel="Tabel (kort på telefon)">
        <TabelKort titel="Seneste salg" hoejre={<Pille variant="sekundaer" stoerrelse="lille">Se alle</Pille>} rows={RAEKKER} rowKey={(r) => r.id}
          columns={[
            { key: "dato", header: "Dato", cell: (r) => r.dato, isKey: true },
            { key: "kunde", header: "Kunde", cell: (r) => r.kunde, isTitle: true },
            { key: "beloeb", header: "Beløb", cell: (r) => <span className="tabular-nums">{r.beloeb}</span>, isKey: true },
          ]} />
      </Afsnit>
    </Side>
    </MainLayout>
  );
}
