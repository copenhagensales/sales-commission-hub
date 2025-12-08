import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Info } from "lucide-react";
import { format, endOfWeek, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import type { WeeklyMetrics } from "@/hooks/useSomeMetrics";

interface SomeWeeklyMetricsCardProps {
  weekStartDate: string;
  currentMetrics: WeeklyMetrics | null;
  onSave: (metrics: Omit<WeeklyMetrics, "id">) => void;
}

export function SomeWeeklyMetricsCard({ weekStartDate, currentMetrics, onSave }: SomeWeeklyMetricsCardProps) {
  const weekStart = parseISO(weekStartDate);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, "d. MMM", { locale: da })} – ${format(weekEnd, "d. MMM yyyy", { locale: da })}`;
  const [tiktokFollowers, setTiktokFollowers] = useState(0);
  const [tiktokViews, setTiktokViews] = useState(0);
  const [tiktokLikes, setTiktokLikes] = useState(0);
  const [instaFollowers, setInstaFollowers] = useState(0);
  const [instaViews, setInstaViews] = useState(0);
  const [instaLikes, setInstaLikes] = useState(0);

  useEffect(() => {
    if (currentMetrics) {
      setTiktokFollowers(currentMetrics.tiktok_followers);
      setTiktokViews(currentMetrics.tiktok_views);
      setTiktokLikes(currentMetrics.tiktok_likes);
      setInstaFollowers(currentMetrics.insta_followers);
      setInstaViews(currentMetrics.insta_views);
      setInstaLikes(currentMetrics.insta_likes);
    } else {
      setTiktokFollowers(0);
      setTiktokViews(0);
      setTiktokLikes(0);
      setInstaFollowers(0);
      setInstaViews(0);
      setInstaLikes(0);
    }
  }, [currentMetrics, weekStartDate]);

  const handleSave = () => {
    onSave({
      week_start_date: weekStartDate,
      tiktok_followers: tiktokFollowers,
      tiktok_views: tiktokViews,
      tiktok_likes: tiktokLikes,
      insta_followers: instaFollowers,
      insta_views: instaViews,
      insta_likes: instaLikes,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Ugerapport: Uge {format(weekStart, "w", { locale: da })}</CardTitle>
            <CardDescription className="mt-1">
              {weekLabel}
            </CardDescription>
          </div>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-1" />
            Gem
          </Button>
        </div>
        <div className="flex items-start gap-2 mt-3 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Indtast dine tal for den valgte uge ovenfor. Brug ugeskifteren øverst til at navigere mellem uger. 
            Når du gemmer, knyttes tallene til den viste uge og vises i grafen nedenfor.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* TikTok */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-black" />
              TikTok
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Følgere</Label>
                <Input
                  type="number"
                  value={tiktokFollowers}
                  onChange={(e) => setTiktokFollowers(Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Visninger</Label>
                <Input
                  type="number"
                  value={tiktokViews}
                  onChange={(e) => setTiktokViews(Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Likes</Label>
                <Input
                  type="number"
                  value={tiktokLikes}
                  onChange={(e) => setTiktokLikes(Number(e.target.value))}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          {/* Instagram */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
              Instagram
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">Følgere</Label>
                <Input
                  type="number"
                  value={instaFollowers}
                  onChange={(e) => setInstaFollowers(Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Visninger</Label>
                <Input
                  type="number"
                  value={instaViews}
                  onChange={(e) => setInstaViews(Number(e.target.value))}
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Likes</Label>
                <Input
                  type="number"
                  value={instaLikes}
                  onChange={(e) => setInstaLikes(Number(e.target.value))}
                  className="h-8"
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
