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
  previousMetrics: WeeklyMetrics | null;
  onSave: (metrics: Omit<WeeklyMetrics, "id">) => void;
}

export function SomeWeeklyMetricsCard({ weekStartDate, currentMetrics, previousMetrics, onSave }: SomeWeeklyMetricsCardProps) {
  const weekStart = parseISO(weekStartDate);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, "d. MMM", { locale: da })} – ${format(weekEnd, "d. MMM yyyy", { locale: da })}`;
  
  // Total values (what user enters)
  const [tiktokFollowersTotal, setTiktokFollowersTotal] = useState(0);
  const [tiktokViews, setTiktokViews] = useState(0);
  const [tiktokLikesTotal, setTiktokLikesTotal] = useState(0);
  const [instaFollowersTotal, setInstaFollowersTotal] = useState(0);
  const [instaViews, setInstaViews] = useState(0);
  const [instaLikes, setInstaLikes] = useState(0);

  // Baseline from previous week (or hardcoded baseline if no previous)
  const baselineTiktokFollowers = previousMetrics?.tiktok_followers ?? 4567;
  const baselineTiktokLikes = previousMetrics?.tiktok_likes ?? 80555;
  const baselineInstaFollowers = previousMetrics?.insta_followers ?? 1009;

  // Calculate deltas
  const tiktokFollowersDelta = tiktokFollowersTotal - baselineTiktokFollowers;
  const tiktokLikesDelta = tiktokLikesTotal - baselineTiktokLikes;
  const instaFollowersDelta = instaFollowersTotal - baselineInstaFollowers;

  useEffect(() => {
    if (currentMetrics) {
      // When loading existing data, show the stored totals
      setTiktokFollowersTotal(currentMetrics.tiktok_followers);
      setTiktokViews(currentMetrics.tiktok_views);
      setTiktokLikesTotal(currentMetrics.tiktok_likes);
      setInstaFollowersTotal(currentMetrics.insta_followers);
      setInstaViews(currentMetrics.insta_views);
      setInstaLikes(currentMetrics.insta_likes);
    } else {
      // Default to baseline values for new entries
      setTiktokFollowersTotal(baselineTiktokFollowers);
      setTiktokViews(0);
      setTiktokLikesTotal(baselineTiktokLikes);
      setInstaFollowersTotal(baselineInstaFollowers);
      setInstaViews(0);
      setInstaLikes(0);
    }
  }, [currentMetrics, weekStartDate, baselineTiktokFollowers, baselineTiktokLikes, baselineInstaFollowers]);

  const handleSave = () => {
    onSave({
      week_start_date: weekStartDate,
      tiktok_followers: tiktokFollowersTotal,
      tiktok_views: tiktokViews,
      tiktok_likes: tiktokLikesTotal,
      insta_followers: instaFollowersTotal,
      insta_views: instaViews,
      insta_likes: instaLikes,
    });
  };

  const formatDelta = (delta: number) => {
    if (delta > 0) return `+${delta.toLocaleString("da-DK")}`;
    if (delta < 0) return delta.toLocaleString("da-DK");
    return "0";
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
            Indtast det <strong>samlede antal</strong> følgere/likes. Systemet beregner automatisk stigningen fra forrige uge.
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
                <Label className="text-xs text-muted-foreground">Følgere (total)</Label>
                <Input
                  type="number"
                  value={tiktokFollowersTotal}
                  onChange={(e) => setTiktokFollowersTotal(Number(e.target.value))}
                  className="h-8"
                />
                <span className={`text-xs ${tiktokFollowersDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatDelta(tiktokFollowersDelta)} denne uge
                </span>
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
                <Label className="text-xs text-muted-foreground">Likes (total)</Label>
                <Input
                  type="number"
                  value={tiktokLikesTotal}
                  onChange={(e) => setTiktokLikesTotal(Number(e.target.value))}
                  className="h-8"
                />
                <span className={`text-xs ${tiktokLikesDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatDelta(tiktokLikesDelta)} denne uge
                </span>
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
                <Label className="text-xs text-muted-foreground">Følgere (total)</Label>
                <Input
                  type="number"
                  value={instaFollowersTotal}
                  onChange={(e) => setInstaFollowersTotal(Number(e.target.value))}
                  className="h-8"
                />
                <span className={`text-xs ${instaFollowersDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatDelta(instaFollowersDelta)} denne uge
                </span>
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
