import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { urlBase64ToUint8Array } from "@/lib/push/pushPrompt";


export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ?? null;
}

export const PUSH_NOT_READY_MESSAGE =
  "Notifikationer kunne ikke slås til endnu. Luk appen helt, åbn den igen og prøv en gang til.";
export const SW_READY_TIMEOUT_MS = 10_000;

/** Afventer en aktiv service worker (navigator.serviceWorker.ready) med kontrolleret timeout. */
export async function waitForActiveRegistration(timeoutMs = SW_READY_TIMEOUT_MS): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); }),
    ]);
    return reg && reg.active ? reg : null;
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
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

/** Selvhelende tilmelding: genopretter enhedens række/abonnement, når tilladelsen allerede er givet. Fejler stille. */
export async function ensurePushSubscription(): Promise<void> {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (!(await getRegistration())) return;
    const reg = await waitForActiveRegistration();
    if (!reg) return;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { data: keyRes, error: keyErr } = await supabase.functions.invoke("push-public-key", { body: {} });
      if (keyErr || !keyRes?.publicKey) return;
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey) });
    }
    const json = sub.toJSON();
    await supabase.from("push_subscriptions").upsert(
      { user_id: u.user.id, endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", user_agent: navigator.userAgent.slice(0, 200), is_active: true, deactivated_at: null },
      { onConflict: "endpoint" },
    );
  } catch { /* stille */ }
}

/** Push-status og præferencer for den indloggede bruger. */
export function usePushNotifications() {
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

  const refresh = useCallback(async () => {
    try {
      const s = await (await getRegistration())?.pushManager.getSubscription();
      setSubscribed(!!s);
      if (pushSupported()) setPermission(Notification.permission);
    } catch { /* ignore */ }
  }, []);

  const subscribe = useCallback(async () => {
    if (!(await getRegistration())) throw new Error("Notifikationer virker kun i den installerede Stork-app.");
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") throw new Error("Notifikationer blev ikke tilladt.");
    const { data: keyRes, error: keyErr } = await supabase.functions.invoke("push-public-key", { body: {} });
    if (keyErr || !keyRes?.publicKey) throw new Error("Kunne ikke hente nøgle.");
    const reg = await waitForActiveRegistration();
    if (!reg) throw new Error(PUSH_NOT_READY_MESSAGE);
    let sub: PushSubscription;
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey) });
    } catch {
      throw new Error(PUSH_NOT_READY_MESSAGE);
    }
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

  return { supported, permission, subscribed, ready, refresh, subscribe, unsubscribe, sendTest };
}
