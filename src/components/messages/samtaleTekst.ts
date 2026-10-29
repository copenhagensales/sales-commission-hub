// D2a: rene tekstfunktioner til Beskeder (navn, initialer, kort tid). Ingen React.
import { format, isToday, isYesterday, isThisYear } from "date-fns";
import { da } from "date-fns/locale";
import type { Conversation } from "@/hooks/useChat";

/** Samtalens visningsnavn: gruppenavn eller deltagernes navne. Bruges også i trådens sidehoved (Messages). */
export function samtaleNavn(conversation: Conversation, migId?: string | null): string {
  if (conversation.is_group) return conversation.name || "Gruppe";
  const navne = (conversation.members ?? []).filter((m) => m.employee).map((m) => ({ id: m.employee_id, navn: m.employee?.full_name ?? "" }));
  // D2a: i en direkte samtale vises kun den anden part (som i enhver beskedapp); er jeg alene, vises mit eget navn.
  const andre = migId ? navne.filter((m) => m.id !== migId) : navne;
  return (andre.length ? andre : navne).map((m) => m.navn).filter(Boolean).join(", ") || "Samtale";
}
/** Initialer til avataren: første bogstav i de to første ord. */
export function initialer(navn: string): string {
  return navn.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((o) => o[0]?.toUpperCase() ?? "").join("") || "?";
}
/** Kort tid som i en beskedliste: »14.02«, »i går«, »12. okt.«, »12.10.25«. */
export function kortTid(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return format(d, "HH.mm");
  if (isYesterday(d)) return "i går";
  if (isThisYear(d)) return format(d, "d. MMM", { locale: da });
  return format(d, "dd.MM.yy");
}

