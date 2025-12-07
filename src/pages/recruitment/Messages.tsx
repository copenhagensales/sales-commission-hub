import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Send,
  User,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

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
}

export default function Messages() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<MessageType | "all">("all");
  const queryClient = useQueryClient();

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
        .select("id, first_name, last_name, phone, email");
      
      if (error) throw error;
      return data;
    },
  });

  const filteredMessages = messages.filter((message) => {
    const matchesSearch = message.content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "all" || message.type === activeTab;
    return matchesSearch && matchesTab;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "call":
        return <Phone className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "sms":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "email":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "call":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const typeCounts = messages.reduce((acc, msg) => {
    acc[msg.type] = (acc[msg.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <MainLayout>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Beskeder</h1>
          <p className="text-muted-foreground">Kommunikationshistorik med kandidater</p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="destructive">{unreadCount} ulæste</Badge>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total beskeder</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{messages.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">SMS</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{typeCounts.sms || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emails</CardTitle>
            <Mail className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">{typeCounts.email || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Opkald</CardTitle>
            <Phone className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{typeCounts.call || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søg i beskeder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background border-border"
          />
        </div>
      </div>

      {/* Type Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MessageType | "all")}>
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="all" className="data-[state=active]:bg-background">
            Alle ({messages.length})
          </TabsTrigger>
          <TabsTrigger value="sms" className="data-[state=active]:bg-background">
            SMS ({typeCounts.sms || 0})
          </TabsTrigger>
          <TabsTrigger value="email" className="data-[state=active]:bg-background">
            Email ({typeCounts.email || 0})
          </TabsTrigger>
          <TabsTrigger value="call" className="data-[state=active]:bg-background">
            Opkald ({typeCounts.call || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Indlæser beskeder...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Ingen beskeder fundet
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {filteredMessages.map((message) => (
                  <Card 
                    key={message.id} 
                    className={`bg-card border-border ${!message.read ? 'border-l-4 border-l-primary' : ''}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`p-2 rounded-lg ${getTypeColor(message.type)}`}>
                            {getTypeIcon(message.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={getTypeColor(message.type)}>
                                {message.type.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {message.direction === "outbound" ? "Udgående" : "Indgående"}
                              </Badge>
                              {!message.read && (
                                <Badge variant="destructive" className="text-xs">Ulæst</Badge>
                              )}
                            </div>
                            <p className="text-sm text-foreground line-clamp-2">
                              {message.content || "Ingen indhold"}
                            </p>
                            {message.outcome && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Udfald: {message.outcome}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(message.created_at), "d. MMM HH:mm", { locale: da })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </MainLayout>
  );
}
