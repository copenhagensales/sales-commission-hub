import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { XCircle, Loader2 } from "lucide-react";

const CS_DARK = "#111827";

export default function PublicUnsubscribe() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [title, setTitle] = useState("Du er afmeldt");
  const [bodyLines, setBodyLines] = useState<string[]>([
    "Vi har modtaget din afmelding, og du vil ikke modtage flere beskeder fra os.",
  ]);

  useEffect(() => {
    if (!candidateId) {
      setStatus("error");
      return;
    }

    const run = async () => {
      try {
        const res = await supabase.functions.invoke("unsubscribe-candidate", {
          body: { candidateId },
        });
        if (res.error) throw res.error;

        // Fetch page content for unsubscribe_success
        const { data: pageContent } = await supabase
          .from("booking_page_content")
          .select("title, body_lines")
          .eq("page_key", "unsubscribe_success")
          .maybeSingle();

        // Fetch candidate first name for personalization
        const { data: candidate } = await supabase
          .from("candidates")
          .select("first_name")
          .eq("id", candidateId)
          .maybeSingle();

        const firstName = candidate?.first_name || "";

        if (pageContent?.title) {
          setTitle(pageContent.title.replace("{{firstName}}", firstName));
        } else if (firstName) {
          setTitle(`Tak for din interesse, ${firstName}!`);
        }

        if (pageContent?.body_lines?.length) {
          setBodyLines(pageContent.body_lines);
        } else {
          setBodyLines([
            "Vi har modtaget din afmelding, og du vil ikke modtage flere beskeder fra os.",
            "Vi sætter stor pris på, at du tog dig tid til at søge hos os – det betyder meget.",
            "Du er altid velkommen til at søge igen en anden gang. Vi vil med glæde høre fra dig!",
          ]);
        }

        setStatus("success");
      } catch {
        setStatus("error");
      }
    };
    run();
  }, [candidateId]);

  const fontStyle = { fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4" style={fontStyle}>
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-sm text-gray-500">Behandler din afmelding...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4" style={fontStyle}>
        <div className="max-w-md w-full text-center rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
          <XCircle className="h-12 w-12 mx-auto text-red-400" />
          <h2 className="text-xl font-semibold tracking-[-0.02em]" style={{ color: CS_DARK }}>Der opstod en fejl</h2>
          <p className="text-sm text-gray-500">
            Prøv venligst igen senere, eller kontakt os direkte.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4" style={fontStyle}>
      <div className="max-w-md w-full text-center rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold tracking-[-0.02em]" style={{ color: CS_DARK }}>{title}</h2>
        {bodyLines.map((line, i) => (
          <p key={i} className="text-sm text-gray-500">{line}</p>
        ))}
        <div className="w-12 h-0.5 bg-gray-200 mx-auto my-4" />
        <p className="text-xs text-gray-400">Venlig hilsen, Copenhagen Sales</p>
      </div>
    </div>
  );
}
