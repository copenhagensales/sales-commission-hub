import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const ShortLinkRedirect = () => {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) return;
    supabase
      .from("short_links")
      .select("id, target_url, candidate_id, first_clicked_at, click_count")
      .eq("code", code)
      .single()
      .then(({ data }) => {
        if (!data?.target_url) return;

        const now = new Date().toISOString();
        // Fire-and-forget click logging (do not block redirect)
        void supabase.from("short_link_clicks").insert({
          short_link_id: data.id,
          candidate_id: data.candidate_id,
          user_agent: navigator.userAgent,
        });
        void supabase
          .from("short_links")
          .update({
            click_count: (data.click_count ?? 0) + 1,
            last_clicked_at: now,
            ...(data.first_clicked_at ? {} : { first_clicked_at: now }),
          })
          .eq("id", data.id);

        window.location.href = data.target_url;
      });
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Omdirigerer...</p>
    </div>
  );
};

export default ShortLinkRedirect;
