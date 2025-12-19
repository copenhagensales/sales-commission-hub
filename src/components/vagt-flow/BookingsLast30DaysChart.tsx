import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { da } from "date-fns/locale";

// Color palette for clients
const CLIENT_COLORS = [
  "hsl(var(--primary))",
  "hsl(221, 83%, 53%)",
  "hsl(142, 76%, 36%)",
  "hsl(45, 93%, 47%)",
  "hsl(280, 65%, 60%)",
  "hsl(0, 72%, 51%)",
  "hsl(199, 89%, 48%)",
  "hsl(339, 82%, 51%)",
];

export function BookingsLast30DaysChart() {
  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ["bookings-last-30-days-chart"],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = subDays(endDate, 29);

      const { data, error } = await supabase
        .from("booking")
        .select(`
          id,
          start_date,
          client_id,
          clients(name)
        `)
        .gte("start_date", format(startDate, "yyyy-MM-dd"))
        .lte("start_date", format(endDate, "yyyy-MM-dd"));

      if (error) throw error;
      return data;
    },
  });

  const chartData = useMemo(() => {
    if (!bookingsData) return { data: [], clients: [] };

    const endDate = new Date();
    const startDate = subDays(endDate, 29);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Get unique clients
    const clientsMap = new Map<string, string>();
    bookingsData.forEach((b: any) => {
      if (b.client_id && b.clients?.name) {
        clientsMap.set(b.client_id, b.clients.name);
      }
    });
    const clients = Array.from(clientsMap.entries()).map(([id, name]) => ({ id, name }));

    // Build data for each day
    const data = days.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayLabel = format(day, "d/M", { locale: da });

      const entry: any = { date: dayLabel };

      clients.forEach(client => {
        const count = bookingsData.filter(
          (b: any) => b.start_date === dateStr && b.client_id === client.id
        ).length;
        entry[client.name] = count;
      });

      return entry;
    });

    return { data, clients };
  }, [bookingsData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bookinger de sidste 30 dage</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Indlæser...</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.clients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bookinger de sidste 30 dage</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Ingen bookinger i perioden</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bookinger de sidste 30 dage pr. kunde</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11 }} 
              interval={2}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis 
              allowDecimals={false} 
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend />
            {chartData.clients.map((client, idx) => (
              <Bar
                key={client.id}
                dataKey={client.name}
                stackId="a"
                fill={CLIENT_COLORS[idx % CLIENT_COLORS.length]}
                radius={idx === chartData.clients.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
