import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Monitor, Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function TvBoardLogin() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("tv_board_access")
        .select("id, dashboard_slug, is_active")
        .eq("access_code", code.toUpperCase())
        .eq("is_active", true)
        .single();

      if (queryError || !data) {
        setError("Ugyldig adgangskode");
        setLoading(false);
        return;
      }

      // Update access count and last accessed
      await supabase
        .from("tv_board_access")
        .update({
          last_accessed_at: new Date().toISOString(),
          access_count: (data as any).access_count + 1 || 1,
        })
        .eq("id", data.id);

      // Store code in sessionStorage for the session
      sessionStorage.setItem("tv_board_code", code.toUpperCase());
      sessionStorage.setItem("tv_board_slug", data.dashboard_slug);

      toast.success("Adgang godkendt!");
      navigate(`/tv/${data.dashboard_slug}`);
    } catch (err) {
      console.error("Error verifying code:", err);
      setError("Der opstod en fejl. Prøv igen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-slate-800/50 border-slate-700">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <Monitor className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-white">TV Board</CardTitle>
          <CardDescription className="text-slate-400">
            Indtast adgangskoden for at se dashboardet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <Input
                type="text"
                placeholder="Indtast 6-tegns kode"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                className="pl-10 text-center text-2xl tracking-[0.5em] font-mono uppercase bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                maxLength={6}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={code.length !== 6 || loading}
            >
              {loading ? "Verificerer..." : "Åbn Dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
