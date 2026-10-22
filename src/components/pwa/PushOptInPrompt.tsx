import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useInstallStork } from "@/hooks/useInstallStork";
import { PUSH_PROMPT_DISMISS_KEY, shouldShowPushPrompt } from "@/lib/push/pushPrompt";

/** Diskret, ikke-modal opt-in. Vises kun i den installerede app. Beder først om tilladelse efter "Ja tak". */
export function PushOptInPrompt() {
  const { standalone } = useInstallStork();
  const push = usePushNotifications();
  const [dismissedAt, setDismissedAt] = useState<string | null>(() => {
    try { return localStorage.getItem(PUSH_PROMPT_DISMISS_KEY); } catch { return null; }
  });
  const [busy, setBusy] = useState(false);

  if (!push.ready || !shouldShowPushPrompt({ loggedIn: true, standalone, supported: push.supported, permission: push.permission, subscribed: push.subscribed, dismissedAt })) return null;

  const later = () => {
    const v = String(Date.now());
    try { localStorage.setItem(PUSH_PROMPT_DISMISS_KEY, v); } catch { /* ignore */ }
    setDismissedAt(v);
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-card p-4">
      <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium">Vil du have besked fra Stork på telefonen?</p>
        <p className="text-xs text-muted-foreground">Fx når du når et nyt Klub-niveau. Du kan slå det fra under din profil.</p>
        <div className="flex gap-2">
          <Button size="sm" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await push.subscribe(); toast.success("Notifikationer er slået til"); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Kunne ikke slå til"); later(); }
            finally { setBusy(false); }
          }}>Ja tak</Button>
          <Button size="sm" variant="ghost" onClick={later}>Ikke nu</Button>
        </div>
      </div>
    </div>
  );
}
