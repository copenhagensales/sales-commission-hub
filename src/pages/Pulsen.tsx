import { Activity } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";

/** Pulsen – tom tilstand indtil feedet bygges (trin 4). */
export default function Pulsen() {
  return (
    <MainLayout>
      <div className="mx-auto w-full max-w-[680px] px-4 py-6">
        <h1 className="text-[32px] font-black tracking-tight text-foreground">Pulsen</h1>
        <div className="mt-6 flex flex-col items-center rounded-[24px] bg-card px-8 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary/15">
            <Activity className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-2xl font-extrabold text-foreground">Pulsen åbner snart</h2>
          <p className="mt-2 max-w-md text-[17px] leading-relaxed text-muted-foreground">
            Her samles husets indlæg, ros, spørgsmål, begivenheder og milepæle – for hele huset og for dit team.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
