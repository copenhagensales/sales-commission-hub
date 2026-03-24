import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, Send, Loader2, Sparkles, Settings } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import AgentSettingsDrawer, { type FmAgentSettings } from "@/components/fm-agent/AgentSettingsDrawer";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_ACTIONS = [
  "Giv mig en oversigt over alle lokationer",
  "Hvilke lokationer er sælger-drevne?",
  "Hvem er de bedste sælgere?",
  "Vis risikoflag",
  "Hvor bør vi stå næste uge?",
  "Hvilke sælger+lokation kombinationer er stærkest?",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fm-profit-agent`;

async function streamChat({
  message,
  history,
  settings,
  onDelta,
  onDone,
  onError,
}: {
  message: string;
  history: Msg[];
  settings?: FmAgentSettings | null;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ message, history, settings }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ error: "Ukendt fejl" }));
      onError(body.error || `Fejl ${resp.status}`);
      return;
    }

    if (!resp.body) {
      onError("Ingen stream modtaget");
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    // Flush remaining
    if (buffer.trim()) {
      for (let raw of buffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Netværksfejl");
  }
}

export default function FmProfitAgentContent() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agentSettings, setAgentSettings] = useState<FmAgentSettings | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamChat({
      message: text.trim(),
      history: messages,
      settings: agentSettings,
      onDelta: upsertAssistant,
      onDone: () => setIsLoading(false),
      onError: (err) => {
        toast.error(err);
        setIsLoading(false);
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col">
      {/* Settings drawer */}
      <AgentSettingsDrawer
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSettingsLoaded={setAgentSettings}
      />

      {/* Chat area */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full py-20 gap-6">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center max-w-md">
              <h2 className="text-xl font-semibold mb-2">FM Profit Agent</h2>
              <p className="text-muted-foreground text-sm">
                Stil spørgsmål om lokationer, sælgere og profitabilitet. AI'en analyserer rigtige data fra de seneste {agentSettings?.data_window_weeks ?? 12} uger og forklarer hvad der driver performance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 max-w-lg justify-center">
              {QUICK_ACTIONS.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => send(q)}
                  disabled={isLoading}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {q}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4 max-w-3xl mx-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                    <Brain className="h-4 w-4 text-primary" />
                  </div>
                )}
                <Card className={`max-w-[85%] ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}>
                  <CardContent className="p-3">
                    {msg.role === "user" ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_th]:py-1 [&_td]:py-1">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center mr-2 mt-1">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Quick actions when in conversation */}
      {!isEmpty && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto">
          {QUICK_ACTIONS.slice(0, 4).map((q) => (
            <Button
              key={q}
              variant="ghost"
              size="sm"
              className="text-xs whitespace-nowrap flex-shrink-0"
              onClick={() => send(q)}
              disabled={isLoading}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              {q}
            </Button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            title="Agent indstillinger"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Spørg om lokationer, sælgere, profitabilitet..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={() => send(input)} disabled={!input.trim() || isLoading} size="icon">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
