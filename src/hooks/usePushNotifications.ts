import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { urlBase64ToUint8Array } from "@/lib/push/pushPrompt";

export type PushPrefs = { klub: boolean; opstart_flag: boolean; missing_one_on_one: boolean; compliance: boolean };
const DEFAULT_PREFS: PushPrefs = { klub: true, opstart_flag: true, missing_one_on_one: true, compliance: true };

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ?? null;
}

/** Kaldes FØR signOut: sletter enhedens subscription i databasen (kræver stadig session) og afmelder browseren. */
export async function clearPushSubscription(): Promise<void> {
  try {
    const reg = await getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch { /* må aldrig blokere logud */ }
}

// Ved logud: afmeld browserens abonnement. Serveren deaktiverer det ved næste afsendelse (410).
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event) => {
    if (event !== "SIGNED_OUT") return;
    void getRegistration()
      .then((r) => r?.pushManager.getSubscription())
      .then((s) => s?.unsubscribe())
      .catch(() => undefined);
  });
}

/** Push-status og præferencer for den indloggede bruger. */
export function usePushNotifications() {
  const qc = useQueryClient();
  const supported = pushSupported();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    supported ? Notification.permission : "unsupported",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void getRegistration()
      .then((r) => r?.pushManager.getSubscription())
      .then((s) => { if (alive) { setSubscribed(!!s); setReady(true); } })
      .catch(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);

  const prefs = useQuery({
    queryKey: ["push-preferences"],
    queryFn: async (): Promise<PushPrefs> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return DEFAULT_PREFS;
      const { data, error } = await supabase.from("push_preferences").select("klub, opstart_flag, missing_one_on_one, compliance").eq("user_id", u.user.id).maybeSingle();
      if (error) throw error;
      return data ?? DEFAULT_PREFS;
    },
  });

  const setPref = useMutation({
    mutationFn: async (patch: Partial<PushPrefs>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Ikke logget ind");
      const next = { ...DEFAULT_PREFS, ...(prefs.data ?? {}), ...patch };
      const { error } = await supabase.from("push_preferences").upsert({ user_id: u.user.id, ...next, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["push-preferences"] }),
  });

  const subscribe = useCallback(async () => {
    const reg = await getRegistration();
    if (!reg) throw new Error("Notifikationer virker kun i den installerede Stork-app.");
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") throw new Error("Notifikationer blev ikke tilladt.");
    const { data: keyRes, error: keyErr } = await supabase.functions.invoke("send-push", { body: { action: "public_key" } });
    if (keyErr || !keyRes?.publicKey) throw new Error("Kunne ikke hente nøgle.");
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey) });
    const json = sub.toJSON();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Ikke logget ind");
    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: u.user.id, endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", user_agent: navigator.userAgent.slice(0, 200), is_active: true, deactivated_at: null },
      { onConflict: "endpoint" },
    );
    if (error) throw error;
    setSubscribed(true);
  }, []);

  const unsubscribe = useCallback(async () => {
    const reg = await getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, []);

  const sendTest = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("send-push", { body: { action: "test" } });
      if (error) throw error;
      if (!data?.sent) throw new Error("Ingen aktiv enhed modtog testen.");
    },
  });

  return { supported, permission, subscribed, ready, prefs, setPref, subscribe, unsubscribe, sendTest };
}
