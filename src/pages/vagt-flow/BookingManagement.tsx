import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, ListChecks, CalendarDays, Loader2, Tent, Hotel, BarChart3, Brain, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { lazy, Suspense, useMemo } from "react";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useFmBookingConflicts } from "@/hooks/useFmBookingConflicts";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { da } from "date-fns/locale";

// Lazy load tab contents
const BookWeekContent = lazy(() => import("./BookWeekContent"));
const LocationsContent = lazy(() => import("./LocationsContent"));
const BookingsContent = lazy(() => import("./BookingsContent"));
const MarketsContent = lazy(() => import("./MarketsContent"));
const VagtplanFMContent = lazy(() => import("./VagtplanFMContent"));
const HotelsContent = lazy(() => import("./HotelsContent"));
const LocationProfitabilityContent = lazy(() => import("./LocationProfitabilityContent"));
const FmProfitAgentContent = lazy(() => import("./FmProfitAgentContent"));

// Tab configuration with permission keys
const allTabs = [
  { value: "book-week", label: "Book uge", labelKey: "sidebar.bookWeek", icon: Calendar, permissionKey: "tab_fm_book_week" },
  { value: "bookings", label: "Bookinger", icon: ListChecks, permissionKey: "tab_fm_bookings" },
  { value: "markets", label: "Markeder", icon: Tent, permissionKey: "tab_fm_markets" },
  { value: "locations", label: "Lokationer", labelKey: "sidebar.locations", icon: MapPin, permissionKey: "tab_fm_locations" },
  { value: "vagtplan-fm", label: "Vagtplan", icon: CalendarDays, permissionKey: "tab_fm_vagtplan" },
  { value: "hotels", label: "Hoteller", icon: Hotel, permissionKey: "tab_fm_hotels" },
  { value: "okonomi", label: "Økonomi", icon: BarChart3, permissionKey: "tab_fm_locations" },
  { value: "profit-agent", label: "Profit Agent", icon: Brain, permissionKey: "tab_fm_locations" },
];

export default function BookingManagement() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canView, isLoading, isReady, position, permissions } = usePermissions();
  const { conflicts, count: conflictCount } = useFmBookingConflicts();
  
  // Filter tabs based on permissions
  const visibleTabs = useMemo(() => 
    allTabs.filter(tab => canView(tab.permissionKey)),
    [canView]
  );
  
  // Default to first visible tab
  const defaultTab = visibleTabs[0]?.value || "book-week";
  const urlTab = searchParams.get("tab");
  const activeTab = urlTab && visibleTabs.some(t => t.value === urlTab) ? urlTab : defaultTab;
  
  const weekParam = searchParams.get("week");
  const yearParam = searchParams.get("year");

  const handleTabChange = (value: string) => {
    // Preserve week/year params when changing tabs
    const params: Record<string, string> = { tab: value };
    if (weekParam) params.week = weekParam;
    if (yearParam) params.year = yearParam;
    setSearchParams(params);
  };

  // Debug logging for permission issues
  console.log('[BookingManagement] Permission check:', {
    role: position?.name,
    isLoading,
    isReady,
    permissionKeysCount: Object.keys(permissions || {}).length,
    tabChecks: allTabs.map(t => ({ key: t.permissionKey, hasAccess: canView(t.permissionKey) })),
    visibleTabsCount: visibleTabs.length
  });

  // Wait until data is ACTUALLY ready - prevents race condition
  if (isLoading || !isReady) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <MainLayout>
        <div className="text-center py-12 text-muted-foreground">
          Du har ikke adgang til denne side.
        </div>
      </MainLayout>
    );
  }

  // Dynamic grid columns based on visible tabs
  const gridColsClass = visibleTabs.length <= 2 ? "grid-cols-2" :
                        visibleTabs.length === 3 ? "grid-cols-3" : 
                        visibleTabs.length <= 5 ? "grid-cols-5" :
                        visibleTabs.length === 6 ? "grid-cols-6" : "grid-cols-7";

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("sidebar.booking", "Booking")}</h1>
          <p className="text-muted-foreground">Administrer bookinger, lokationer og planlægning</p>
        </div>

        {conflictCount > 0 && (
          <Alert variant="destructive" className="border-destructive/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{conflictCount} medarbejder(e) tildelt vagter under godkendt fravær</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1 text-sm">
                {conflicts.map((c, i) => (
                  <li key={`${c.employeeId}-${c.date}-${i}`}>
                    <span className="font-medium">{c.employeeName}</span>
                    {" — "}
                    {format(new Date(c.date), "EEEE d. MMM yyyy", { locale: da })}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground w-auto gap-1">
            {visibleTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2 px-3">
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.labelKey ? t(tab.labelKey, tab.label) : tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {visibleTabs.some(t => t.value === "book-week") && (
            <TabsContent value="book-week" className="mt-6">
              <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
                <BookWeekContent />
              </Suspense>
            </TabsContent>
          )}

          {visibleTabs.some(t => t.value === "bookings") && (
            <TabsContent value="bookings" className="mt-6">
              <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
                <BookingsContent />
              </Suspense>
            </TabsContent>
          )}

          {visibleTabs.some(t => t.value === "markets") && (
            <TabsContent value="markets" className="mt-6">
              <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
                <MarketsContent />
              </Suspense>
            </TabsContent>
          )}

          {visibleTabs.some(t => t.value === "locations") && (
            <TabsContent value="locations" className="mt-6">
              <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
                <LocationsContent />
              </Suspense>
            </TabsContent>
          )}

          {visibleTabs.some(t => t.value === "vagtplan-fm") && (
            <TabsContent value="vagtplan-fm" className="mt-6">
              <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
                <VagtplanFMContent />
              </Suspense>
            </TabsContent>
          )}

          {visibleTabs.some(t => t.value === "hotels") && (
            <TabsContent value="hotels" className="mt-6">
              <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
                <HotelsContent />
              </Suspense>
            </TabsContent>
          )}

          {visibleTabs.some(t => t.value === "okonomi") && (
            <TabsContent value="okonomi" className="mt-6">
              <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
                <LocationProfitabilityContent />
              </Suspense>
            </TabsContent>
          )}

          {visibleTabs.some(t => t.value === "profit-agent") && (
            <TabsContent value="profit-agent" className="mt-6">
              <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
                <FmProfitAgentContent />
              </Suspense>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
