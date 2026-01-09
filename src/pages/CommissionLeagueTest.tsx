import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { PremierLeagueBoard } from "@/components/league/PremierLeagueBoard";
import { generateMockStandings, getCurrentEmployeeId } from "@/lib/mockLeagueData";
import { ArrowLeft, RefreshCw, Users, Layers, Eye, Shuffle } from "lucide-react";
import { Link } from "react-router-dom";

const CommissionLeagueTest = () => {
  const [playerCount, setPlayerCount] = useState(50);
  const [playersPerDivision, setPlayersPerDivision] = useState(10);
  const [includeRankChanges, setIncludeRankChanges] = useState(true);
  const [highlightedPlayerIndex, setHighlightedPlayerIndex] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const standings = useMemo(() => {
    return generateMockStandings({
      playerCount,
      playersPerDivision,
      includeRankChanges,
      currentEmployeeIndex: highlightedPlayerIndex
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerCount, playersPerDivision, includeRankChanges, refreshKey]);

  const currentEmployeeId = getCurrentEmployeeId(standings, highlightedPlayerIndex);

  const divisionCount = Math.ceil(playerCount / playersPerDivision);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleRandomizeHighlight = () => {
    setHighlightedPlayerIndex(Math.floor(Math.random() * playerCount));
  };

  const handleSimulateLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/commission-league">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground">Premier League Board Test</h1>
              <p className="text-sm text-muted-foreground">
                Test visning med {playerCount} spillere i {divisionCount} divisioner
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Test Kontroller
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Player Count */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Antal spillere
                    </Label>
                    <span className="text-sm font-medium bg-muted px-2 py-1 rounded">
                      {playerCount}
                    </span>
                  </div>
                  <Slider
                    value={[playerCount]}
                    onValueChange={([value]) => setPlayerCount(value)}
                    min={10}
                    max={100}
                    step={5}
                  />
                  <div className="flex gap-2">
                    {[10, 25, 50, 75, 100].map(count => (
                      <Button
                        key={count}
                        variant={playerCount === count ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setPlayerCount(count)}
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Players per Division */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Per division
                    </Label>
                    <span className="text-sm font-medium bg-muted px-2 py-1 rounded">
                      {playersPerDivision}
                    </span>
                  </div>
                  <Slider
                    value={[playersPerDivision]}
                    onValueChange={([value]) => setPlayersPerDivision(value)}
                    min={5}
                    max={15}
                    step={1}
                  />
                  <div className="flex gap-2">
                    {[5, 8, 10, 12, 15].map(count => (
                      <Button
                        key={count}
                        variant={playersPerDivision === count ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setPlayersPerDivision(count)}
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Highlighted Player */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Din placering</Label>
                    <span className="text-sm font-medium bg-muted px-2 py-1 rounded">
                      #{highlightedPlayerIndex + 1}
                    </span>
                  </div>
                  <Slider
                    value={[highlightedPlayerIndex]}
                    onValueChange={([value]) => setHighlightedPlayerIndex(value)}
                    min={0}
                    max={playerCount - 1}
                    step={1}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={handleRandomizeHighlight}
                  >
                    <Shuffle className="h-4 w-4 mr-2" />
                    Tilfældig placering
                  </Button>
                </div>

                {/* Toggles */}
                <div className="space-y-4 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="rank-changes">Vis rank-ændringer</Label>
                    <Switch
                      id="rank-changes"
                      checked={includeRankChanges}
                      onCheckedChange={setIncludeRankChanges}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleRefresh}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerer data
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleSimulateLoading}
                  >
                    Simuler loading
                  </Button>
                </div>

                {/* Stats */}
                <div className="pt-4 border-t border-border">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Divisioner: {divisionCount}</p>
                    <p>Spillere i sidste division: {playerCount % playersPerDivision || playersPerDivision}</p>
                    <p>Highlighted: {currentEmployeeId || "Ingen"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Board Preview */}
          <div className="lg:col-span-3">
            <PremierLeagueBoard
              standings={standings}
              playersPerDivision={playersPerDivision}
              isLoading={isLoading}
              currentEmployeeId={currentEmployeeId ?? undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommissionLeagueTest;
