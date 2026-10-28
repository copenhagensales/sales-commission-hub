import { useState, useEffect, useRef } from "react";
import { useSearchMessages, onChatSignal, useFristUr, erUdloebet, type SoegeResultat } from "@/hooks/useChat";
import { sessionsGeneration } from "@/lib/sbKladder";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";

interface MessageSearchProps {
  onClose: () => void;
  onSelectMessage: (message: SoegeResultat) => void;
}

/** B2c-1 §5: søgningens tilstande holdes adskilt – en hentefejl er aldrig »Ingen resultater«. */
type Fase =
  | { art: "ingen" }
  | { art: "henter"; q: string; sg: number }
  | { art: "resultat"; q: string; sg: number; data: SoegeResultat[] }
  | { art: "fejl"; q: string; sg: number };

export function MessageSearch({ onClose, onSelectMessage }: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const [fase, setFase] = useState<Fase>({ art: "ingen" });
  const searchMessages = useSearchMessages();
  // Forespørgselsgeneration: kun det seneste kald må skrive tilstand (rydning, ny søgning, brugerskift, afmontering).
  const gen = useRef(0);
  const sidst = useRef<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const koer = (q: string) => {
    const g = ++gen.current;
    const sg = sessionsGeneration();
    sidst.current = q;
    setFase({ art: "henter", q, sg });
    searchMessages.mutateAsync(q).then(
      (data) => { if (g === gen.current && sg === sessionsGeneration()) setFase({ art: "resultat", q, sg, data }); },
      () => { if (g === gen.current && sg === sessionsGeneration()) setFase({ art: "fejl", q, sg }); },
    );
  };
  const koerRef = useRef(koer);
  koerRef.current = koer;

  // Signaler, forgrund og genforbindelse: gamle resultater ryddes og genvalideres med 300 ms debounce.
  useEffect(() => {
    const genvalider = () => {
      if (!sidst.current) return;
      gen.current++;
      const q = sidst.current;
      setFase({ art: "henter", q, sg: sessionsGeneration() });
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => { debounce.current = null; if (sidst.current === q) koerRef.current(q); }, 300);
    };
    const synlig = () => { if (document.visibilityState === "visible") genvalider(); };
    const af = onChatSignal(genvalider);
    window.addEventListener("online", genvalider);
    document.addEventListener("visibilitychange", synlig);
    return () => {
      af();
      window.removeEventListener("online", genvalider);
      document.removeEventListener("visibilitychange", synlig);
      if (debounce.current) clearTimeout(debounce.current);
      gen.current++; // sene svar efter afmontering skriver intet
    };
  }, []);

  const ryd = () => {
    gen.current++;
    sidst.current = null;
    if (debounce.current) { clearTimeout(debounce.current); debounce.current = null; }
    setFase({ art: "ingen" });
  };

  const handleSearch = () => { if (query.trim()) koer(query); };
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter") handleSearch(); };

  // Resultater fra en tidligere sessionsgeneration vises aldrig.
  const aktuel = fase.art !== "ingen" && fase.sg !== sessionsGeneration() ? { art: "ingen" as const } : fase;
  const resultater = aktuel.art === "resultat" ? aktuel.data : [];
  const nu = useFristUr(resultater.map((m) => m.slettes_efter));
  const viste = resultater.filter((m) => !erUdloebet(m.slettes_efter, nu));

  return (
    <div className="border-b p-4 bg-muted/30">
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (!e.target.value.trim()) ryd(); }}
            onKeyDown={handleKeyDown}
            placeholder="Søg i beskeder..."
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} disabled={aktuel.art === "henter"}>
          {aktuel.art === "henter" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Søg"
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {aktuel.art === "resultat" && viste.length > 0 && (
        <ScrollArea className="max-h-60">
          <div className="space-y-2">
            {viste.map((msg) => (
              <button
                key={msg.id}
                onClick={() => onSelectMessage(msg)}
                className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="font-medium">{msg.sender?.full_name}</span>
                  <span>{format(new Date(msg.created_at), "d. MMM yyyy HH:mm", { locale: da })}</span>
                </div>
                <p className="text-sm truncate">{msg.content}</p>
                {msg.conversation && (
                  <p className="text-xs text-muted-foreground mt-1">
                    i: {msg.conversation.name || "Direkte besked"}
                  </p>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      )}

      {aktuel.art === "resultat" && viste.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Ingen resultater fundet
        </p>
      )}

      {aktuel.art === "fejl" && (
        <div className="flex flex-wrap items-center justify-center gap-2 py-2" role="alert">
          <p className="text-[14px] text-destructive">Søgningen kunne ikke gennemføres</p>
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => koer(aktuel.q)}>Prøv igen</Button>
        </div>
      )}
    </div>
  );
}
