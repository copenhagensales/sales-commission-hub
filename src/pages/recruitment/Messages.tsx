import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MainLayout } from "@/components/layout/MainLayout";
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  Search, 
  User,
  Clock,
  ArrowLeft,
  Send,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SendSmsDialog } from "@/components/recruitment/SendSmsDialog";

type MessageType = "sms" | "email" | "call";

interface Message {
  id: string;
  type: string;
  direction: string;
  content: string | null;
  created_at: string;
  read: boolean;
  outcome: string | null;
  application_id: string | null;
  phone_number: string | null;
}

interface Conversation {
  phone_number: string;
  candidate_id: string | null;
  candidate_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
  messages: Message[];
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  applied_position?: string | null;
}

export default function Messages() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<MessageType | "all">("sms");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showSmsDialog, setShowSmsDialog] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["communication_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communication_logs")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Message[];
    },
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, phone, email, applied_position");
      
      if (error) throw error;
      return data as Candidate[];
    },
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communication_logs',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Auto-scroll in conversation view
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.messages]);

  // Group SMS messages into conversations by phone number
  const smsConversations: Conversation[] = (() => {
    const smsMessages = messages.filter(m => m.type === 'sms');
    const byPhone: Record<string, Message[]> = {};
    
    smsMessages.forEach(msg => {
      const phone = msg.phone_number || 'unknown';
      if (!byPhone[phone]) byPhone[phone] = [];
      byPhone[phone].push(msg);
    });

    return Object.entries(byPhone).map(([phone, msgs]) => {
      // Sort messages oldest first for conversation view
      const sortedMsgs = [...msgs].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const latestMsg = msgs[0]; // Already sorted desc from query
      const unreadCount = msgs.filter(m => !m.read && m.direction === 'inbound').length;
      
      // Try to find matching candidate
      const normalizedPhone = phone.replace(/\D/g, '').slice(-8);
      const matchedCandidate = candidates.find(c => 
        c.phone?.replace(/\D/g, '').slice(-8) === normalizedPhone
      );

      return {
        phone_number: phone,
        candidate_id: matchedCandidate?.id || null,
        candidate_name: matchedCandidate 
          ? `${matchedCandidate.first_name} ${matchedCandidate.last_name}`
          : phone,
        last_message: latestMsg?.content || '',
        last_message_time: latestMsg?.created_at || '',
        unread_count: unreadCount,
        messages: sortedMsgs,
      };
    }).sort((a, b) => 
      new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
    );
  })();

  const filteredConversations = smsConversations.filter(conv =>
    conv.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.phone_number.includes(searchQuery) ||
    conv.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMessages = messages.filter((message) => {
    const matchesSearch = message.content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "all" || message.type === activeTab;
    return matchesSearch && matchesTab;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sms": return <MessageSquare className="h-4 w-4" />;
      case "email": return <Mail className="h-4 w-4" />;
      case "call": return <Phone className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "sms": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "email": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "call": return "bg-green-500/20 text-green-400 border-green-500/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const typeCounts = messages.reduce((acc, msg) => {
    acc[msg.type] = (acc[msg.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const unreadCount = messages.filter((m) => !m.read && m.direction === 'inbound').length;

  const handleOpenConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    // Mark messages as read
    const unreadIds = conv.messages.filter(m => !m.read && m.direction === 'inbound').map(m => m.id);
    if (unreadIds.length > 0) {
      supabase
        .from('communication_logs')
        .update({ read: true })
        .in('id', unreadIds)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
        });
    }
  };

  const handleStartNewSms = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setShowSmsDialog(true);
  };

  // Mobile: Show conversation or list
  const isMobileConversationView = selectedConversation !== null;

  return (
    <MainLayout>
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3">
            {isMobileConversationView && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden"
                onClick={() => setSelectedConversation(null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isMobileConversationView ? selectedConversation?.candidate_name : 'Beskeder'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isMobileConversationView 
                  ? selectedConversation?.phone_number 
                  : 'Kommunikationshistorik med kandidater'
                }
              </p>
            </div>
          </div>
          {unreadCount > 0 && !isMobileConversationView && (
            <Badge variant="destructive">{unreadCount} ulæste</Badge>
          )}
        </div>

        {/* Desktop: Side-by-side layout, Mobile: Stack */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Conversation List - Hidden on mobile when viewing conversation */}
          <div className={cn(
            "w-full md:w-80 lg:w-96 flex flex-col shrink-0",
            isMobileConversationView && "hidden md:flex"
          )}>
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg i beskeder..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MessageType | "all")} className="flex flex-col flex-1 min-h-0">
              <TabsList className="bg-muted/50 border border-border shrink-0 w-full grid grid-cols-4">
                <TabsTrigger value="all" className="text-xs data-[state=active]:bg-background">
                  Alle
                </TabsTrigger>
                <TabsTrigger value="sms" className="text-xs data-[state=active]:bg-background">
                  SMS
                </TabsTrigger>
                <TabsTrigger value="email" className="text-xs data-[state=active]:bg-background">
                  Email
                </TabsTrigger>
                <TabsTrigger value="call" className="text-xs data-[state=active]:bg-background">
                  Opkald
                </TabsTrigger>
              </TabsList>

              {/* SMS Conversations */}
              <TabsContent value="sms" className="flex-1 min-h-0 mt-3">
                <ScrollArea className="h-full">
                  <div className="space-y-2 pr-2">
                    {filteredConversations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>Ingen SMS samtaler</p>
                      </div>
                    ) : (
                      filteredConversations.map((conv) => (
                        <Card 
                          key={conv.phone_number}
                          className={cn(
                            "bg-card border-border cursor-pointer hover:bg-muted/30 transition-colors",
                            selectedConversation?.phone_number === conv.phone_number && "ring-2 ring-primary",
                            conv.unread_count > 0 && "border-l-4 border-l-primary"
                          )}
                          onClick={() => handleOpenConversation(conv)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-foreground truncate">
                                    {conv.candidate_name}
                                  </span>
                                  {conv.unread_count > 0 && (
                                    <Badge variant="destructive" className="shrink-0 text-xs">
                                      {conv.unread_count}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {conv.last_message || 'Ingen besked'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {conv.last_message_time && format(
                                    new Date(conv.last_message_time), 
                                    "d. MMM HH:mm", 
                                    { locale: da }
                                  )}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Other message types - basic list view */}
              {['all', 'email', 'call'].map((tabValue) => (
                <TabsContent key={tabValue} value={tabValue} className="flex-1 min-h-0 mt-3">
                  <ScrollArea className="h-full">
                    <div className="space-y-2 pr-2">
                      {filteredMessages.filter(m => tabValue === 'all' || m.type === tabValue).map((message) => (
                        <Card 
                          key={message.id} 
                          className={cn(
                            "bg-card border-border",
                            !message.read && message.direction === 'inbound' && "border-l-4 border-l-primary"
                          )}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              <div className={cn("p-2 rounded-lg shrink-0", getTypeColor(message.type))}>
                                {getTypeIcon(message.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className={cn("text-xs", getTypeColor(message.type))}>
                                    {message.direction === "outbound" ? "↑" : "↓"} {message.type.toUpperCase()}
                                  </Badge>
                                  {!message.read && message.direction === 'inbound' && (
                                    <Badge variant="destructive" className="text-xs">Ulæst</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-foreground line-clamp-2">
                                  {message.content || "Ingen indhold"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {format(new Date(message.created_at), "d. MMM HH:mm", { locale: da })}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Conversation Detail - Desktop or Mobile when selected */}
          <div className={cn(
            "flex-1 flex flex-col border border-border rounded-lg bg-card min-h-0",
            !isMobileConversationView && "hidden md:flex"
          )}>
            {selectedConversation ? (
              <>
                {/* Desktop header */}
                <div className="hidden md:flex items-center gap-3 p-4 border-b border-border shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">{selectedConversation.candidate_name}</h2>
                    <p className="text-sm text-muted-foreground">{selectedConversation.phone_number}</p>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-3">
                    {selectedConversation.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          msg.direction === "outbound" ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] rounded-2xl px-4 py-2",
                            msg.direction === "outbound"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted text-foreground rounded-bl-md"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={cn(
                            "text-xs mt-1",
                            msg.direction === "outbound" 
                              ? "text-primary-foreground/70" 
                              : "text-muted-foreground"
                          )}>
                            {format(new Date(msg.created_at), "d. MMM HH:mm", { locale: da })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Reply prompt */}
                <div className="p-4 border-t border-border shrink-0">
                  <Button
                    className="w-full"
                    onClick={() => {
                      const candidate = candidates.find(c => 
                        c.phone?.replace(/\D/g, '').slice(-8) === selectedConversation.phone_number.replace(/\D/g, '').slice(-8)
                      );
                      if (candidate) {
                        handleStartNewSms(candidate);
                      }
                    }}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Svar
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Vælg en samtale</p>
                  <p className="text-sm">Klik på en samtale til venstre</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SMS Dialog */}
      {selectedCandidate && (
        <SendSmsDialog
          open={showSmsDialog}
          onOpenChange={(open) => {
            setShowSmsDialog(open);
            if (!open) {
              // Refresh conversation after closing dialog
              queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
            }
          }}
          candidate={selectedCandidate}
        />
      )}
    </MainLayout>
  );
}
