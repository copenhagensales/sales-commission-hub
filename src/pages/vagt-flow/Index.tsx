import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { format, startOfWeek, endOfWeek, getWeek, getYear } from "date-fns";
import { da } from "date-fns/locale";

export default function VagtFlowIndex() {
  const navigate = useNavigate();
  const now = new Date();
  const currentWeek = getWeek(now, { weekStartsOn: 1 });
  const currentYear = getYear(now);

  const { data: thisWeekBookings } = useQuery({
    queryKey: ["vagt-this-week-bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking")
        .select(`
          *,
          location(name, address_city),
          clients(id, name),
          client_campaigns:campaign_id(id, name)
        `)
        .eq("week_number", currentWeek)
        .eq("year", currentYear)
        .in("status", ["Planlagt", "Bekræftet"]);
      if (error) throw error;
      return data;
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["vagt-active-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location")
        .select("id")
        .eq("status", "Aktiv");
      if (error) throw error;
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["vagt-active-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee")
        .select("id")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const eesyCount = thisWeekBookings?.filter((b: any) => b.clients?.name?.toLowerCase().includes("eesy")).length || 0;
  const youseeCount = thisWeekBookings?.filter((b: any) => b.clients?.name?.toLowerCase().includes("yousee")).length || 0;

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Vagtplanlægning</h1>
          <p className="text-muted-foreground">
            Uge {currentWeek}, {currentYear} - {format(startOfWeek(now, { weekStartsOn: 1 }), "d. MMM", { locale: da })} til {format(endOfWeek(now, { weekStartsOn: 1 }), "d. MMM", { locale: da })}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bookinger denne uge</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{thisWeekBookings?.length || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="text-orange-500">{eesyCount} Eesy</span>
                {" • "}
                <span className="text-blue-600">{youseeCount} YouSee</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktive lokationer</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{locations?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktive medarbejdere</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees?.length || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Belægningsgrad</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Kommer snart</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Hurtige handlinger</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/vagt-flow/book-week")}>
                <Calendar className="h-4 w-4 mr-2" />
                Book uge
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/vagt-flow/locations")}>
                <MapPin className="h-4 w-4 mr-2" />
                Administrer lokationer
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/vagt-flow/bookings")}>
                <Calendar className="h-4 w-4 mr-2" />
                Se alle bookinger
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bookinger denne uge</CardTitle>
            </CardHeader>
            <CardContent>
              {thisWeekBookings && thisWeekBookings.length > 0 ? (
                <div className="space-y-3">
                  {thisWeekBookings.slice(0, 5).map((booking: any) => (
                    <div key={booking.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{booking.location?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(booking.start_date), "d/M")} - {format(new Date(booking.end_date), "d/M")}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {booking.client_campaigns?.name || booking.clients?.name || "-"}
                      </Badge>
                    </div>
                  ))}
                  {thisWeekBookings.length > 5 && (
                    <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/vagt-flow/bookings")}>
                      Se alle {thisWeekBookings.length} bookinger
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Ingen bookinger denne uge</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
