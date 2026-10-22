import { MainLayout } from "@/components/layout/MainLayout";

/** Pulsen – trin 1: tom side bag rettigheden menu_pulsen. Feedet bygges i senere trin. */
export default function Pulsen() {
  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-[680px] py-6">
        <h1 className="text-[32px] font-black tracking-tight text-foreground">Pulsen</h1>
        <div className="mt-6 rounded-[24px] bg-card p-8">
          <p className="text-[17px] leading-relaxed text-muted-foreground">
            Pulsen er på vej. Her kommer husets feed med indlæg, ros, spørgsmål og milepæle.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
