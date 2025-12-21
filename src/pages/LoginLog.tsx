import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoginLog } from "@/hooks/useLoginLog";
import { format, formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";
import { Users, Clock, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/MainLayout";

export default function LoginLog() {
  const { recentLogins, loginStats, activeUsers, isLoading, refetch } = useLoginLog();

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto py-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Login Log</h1>
          <p className="text-muted-foreground">
            Oversigt over logins de sidste 24 timer
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Opdater
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktive brugere</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              Unikke brugere sidste 24 timer
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale logins</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentLogins.length}</div>
            <p className="text-xs text-muted-foreground">
              Login events sidste 24 timer
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seneste login</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recentLogins[0]
                ? formatDistanceToNow(new Date(recentLogins[0].logged_in_at), {
                    addSuffix: true,
                    locale: da,
                  })
                : "Ingen"}
            </div>
            <p className="text-xs text-muted-foreground">
              {recentLogins[0]?.user_name || recentLogins[0]?.user_email || "Ingen logins"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Login Stats per User */}
      <Card>
        <CardHeader>
          <CardTitle>Logins de sidste 24 timer</CardTitle>
          <CardDescription>
            Oversigt over brugere der har logget ind
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bruger</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Seneste login</TableHead>
                <TableHead className="text-center">Antal logins</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loginStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Ingen logins de sidste 24 timer
                  </TableCell>
                </TableRow>
              ) : (
                loginStats.map((stat) => (
                  <TableRow key={stat.user_email}>
                    <TableCell className="font-medium">
                      {stat.user_name || "Ukendt"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {stat.user_email}
                    </TableCell>
                    <TableCell>
                      {format(new Date(stat.last_login), "dd. MMM HH:mm", { locale: da })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={stat.login_count > 5 ? "default" : "secondary"}>
                        {stat.login_count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </MainLayout>
  );
}
