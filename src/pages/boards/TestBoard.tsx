import { useEffect, useState } from "react";
import { TrendingUp, ShoppingCart, Maximize, Minimize } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";

interface CampaignSales {
  campaignName: string;
  salesCount: number;
}

export default function TestBoard() {
  const [time, setTime] = useState(new Date());
  const [campaignSales, setCampaignSales] = useState<CampaignSales[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const fetchData = async () => {
    try {
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

      // Fetch today's sales with campaign info via client_campaigns
      const { data: salesData } = await supabase
        .from('sales')
        .select(`
          id,
          client_campaign_id,
          client_campaigns (
            name
          ),
          sale_items (
            quantity
          )
        `)
        .gte('sale_datetime', startOfToday)
        .not('client_campaign_id', 'is', null);

      if (!salesData) {
        setCampaignSales([]);
        return;
      }

      // Group sales by campaign
      const campaignMap = new Map<string, { name: string; count: number }>();

      salesData.forEach(sale => {
        const campaignName = (sale.client_campaigns as any)?.name || 'Ukendt kampagne';
        const existing = campaignMap.get(campaignName) || { name: campaignName, count: 0 };
        
        // Count sale items quantity - ensure we parse quantity as number
        const items = sale.sale_items || [];
        let saleCount = 0;
        for (const item of items) {
          const qty = parseInt(String(item.quantity), 10);
          saleCount += isNaN(qty) || qty < 1 ? 1 : qty;
        }
        // If no items, count as 1 sale
        if (saleCount === 0) saleCount = 1;
        
        existing.count += saleCount;
        campaignMap.set(campaignName, existing);
      });

      // Convert to array and sort by count
      const sortedCampaigns = Array.from(campaignMap.values())
        .map(c => ({ campaignName: c.name, salesCount: c.count }))
        .sort((a, b) => b.salesCount - a.salesCount);

      setCampaignSales(sortedCampaigns);
    } catch (error) {
      console.error("Error fetching campaign sales:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('testboard-sales')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sales' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const totalSales = campaignSales.reduce((sum, c) => sum + c.salesCount, 0);

  return (
    <MainLayout>
      <div className="min-h-screen bg-background p-8">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <TrendingUp className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold text-foreground">Kampagne Wallboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
              className="h-12 w-12"
              title={isFullscreen ? "Afslut fuldskærm" : "Fuldskærm"}
            >
              {isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
            </Button>
            <div className="text-right">
              <p className="text-5xl font-bold tabular-nums text-foreground">
                {time.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-xl text-muted-foreground">
                {time.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          </div>
        </header>

        {/* Total sales today */}
        <div className="mb-8 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/20 p-8 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <p className="text-7xl font-bold text-green-500 mb-2">{totalSales}</p>
          <p className="text-xl text-muted-foreground">Salg i dag (alle kampagner)</p>
        </div>

        {/* Campaign breakdown */}
        <div className="rounded-2xl border border-border bg-card p-8">
          <h2 className="mb-6 text-2xl font-bold text-foreground flex items-center gap-3">
            <ShoppingCart className="h-8 w-8 text-primary" />
            Salg pr. kampagne i dag
          </h2>
          
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Indlæser...</p>
          ) : campaignSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Ingen salg registreret i dag endnu</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {campaignSales.map((campaign, index) => (
                <div 
                  key={campaign.campaignName}
                  className={`rounded-xl p-6 text-center ${
                    index === 0 
                      ? "bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30" 
                      : "bg-muted/30 border border-border"
                  }`}
                >
                  <p className="text-lg font-semibold text-foreground mb-2 truncate" title={campaign.campaignName}>
                    {campaign.campaignName}
                  </p>
                  <p className={`text-5xl font-bold mb-1 ${index === 0 ? 'text-primary' : 'text-green-500'}`}>
                    {campaign.salesCount}
                  </p>
                  <p className="text-muted-foreground">salg</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="mt-8 text-center text-sm text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live-opdatering aktiv
          </div>
        </footer>
      </div>
    </MainLayout>
  );
}
