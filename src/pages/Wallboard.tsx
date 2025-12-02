import { useEffect, useState } from "react";
import { Phone, ShoppingCart, Trophy, TrendingUp } from "lucide-react";

// Mock data - will be replaced with real data
const mockTopAgents = [
  { name: "Anders Jensen", sales: 12 },
  { name: "Maria Nielsen", sales: 10 },
  { name: "Peter Hansen", sales: 8 },
];

export default function Wallboard() {
  const [time, setTime] = useState(new Date());
  const [stats, setStats] = useState({
    callsToday: 1247,
    salesToday: 168,
    conversionRate: 13.5,
    meetingsBooked: 42,
  });

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refresh stats every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // TODO: Fetch real data
      console.log("Refreshing wallboard data...");
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <TrendingUp className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground">PayTrack Live</h1>
        </div>
        <div className="text-right">
          <p className="text-5xl font-bold tabular-nums text-foreground">
            {time.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="text-xl text-muted-foreground">
            {time.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
      </header>

      {/* Main Stats Grid */}
      <div className="grid gap-6 lg:grid-cols-4 mb-8">
        <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 p-8 text-center">
          <Phone className="mx-auto h-12 w-12 text-primary mb-4" />
          <p className="text-7xl font-bold text-foreground mb-2">{stats.callsToday.toLocaleString()}</p>
          <p className="text-xl text-muted-foreground">Opkald i dag</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-success/20 to-success/5 border border-success/20 p-8 text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-success mb-4" />
          <p className="text-7xl font-bold text-success mb-2">{stats.salesToday}</p>
          <p className="text-xl text-muted-foreground">Salg i dag</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-warning/20 to-warning/5 border border-warning/20 p-8 text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-warning mb-4" />
          <p className="text-7xl font-bold text-warning mb-2">{stats.conversionRate}%</p>
          <p className="text-xl text-muted-foreground">Conversion</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-accent to-accent/50 border border-border p-8 text-center">
          <Trophy className="mx-auto h-12 w-12 text-foreground mb-4" />
          <p className="text-7xl font-bold text-foreground mb-2">{stats.meetingsBooked}</p>
          <p className="text-xl text-muted-foreground">Møder booket</p>
        </div>
      </div>

      {/* Top Performers */}
      <div className="rounded-2xl border border-border bg-card p-8">
        <h2 className="mb-6 text-2xl font-bold text-foreground flex items-center gap-3">
          <Trophy className="h-8 w-8 text-warning" />
          Dagens Top 3
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {mockTopAgents.map((agent, index) => (
            <div 
              key={agent.name}
              className={`rounded-xl p-6 text-center ${
                index === 0 
                  ? "bg-gradient-to-br from-warning/20 to-warning/5 border-2 border-warning/30" 
                  : "bg-muted/30 border border-border"
              }`}
            >
              <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold ${
                index === 0 
                  ? "bg-warning text-warning-foreground" 
                  : "bg-muted text-muted-foreground"
              }`}>
                {index + 1}
              </div>
              <p className="text-2xl font-bold text-foreground">{agent.name}</p>
              <p className="mt-2 text-4xl font-bold text-success">{agent.sales}</p>
              <p className="text-muted-foreground">salg</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer with auto-refresh indicator */}
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
          </span>
          Auto-opdatering hvert 30. sekund
        </div>
      </footer>
    </div>
  );
}
