import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ShortLinkRedirect = () => {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) return;
    supabase
      .from("short_links")
      .select("target_url")
      .eq("code", code)
      .single()
      .then(({ data }) => {
        if (data?.target_url) {
          window.location.href = data.target_url;
        }
      });
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Omdirigerer...</p>
    </div>
  );
};

export default ShortLinkRedirect;
