import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, ListChecks, CalendarDays, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { lazy, Suspense, useMemo } from "react";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";

// Lazy load tab contents
const BookWeekContent = lazy(() => import("./BookWeekContent"));
const LocationsContent = lazy(() => import("./LocationsContent"));
const BookingsContent = lazy(() => import("./BookingsContent"));
const VagtplanFMContent = lazy(() => import("./VagtplanFMContent"));

// Tab configuration with permission keys
const allTabs = [
  { value: "book-week", label: "Book uge", labelKey: "sidebar.bookWeek", icon: Calendar, permissionKey: "tab_fm_book_week" },
  { value: "bookings", label: "Kommende bookinger", icon: ListChecks, permissionKey: "tab_fm_bookings" },
  { value: "locations", label: "Lokationer", labelKey: "sidebar.locations", icon: MapPin, permissionKey: "tab_fm_locations" },
  { value: "vagtplan-fm", label: "Vagtplan FM", icon: CalendarDays, permissionKey: "tab_fm_vagtplan" },
];

export default function BookingManagement() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canView, isLoading } = useUnifiedPermissions();
  
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

  if (isLoading) {
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
  const gridColsClass = visibleTabs.length === 1 ? "grid-cols-1" :
                        visibleTabs.length === 2 ? "grid-cols-2" :
                        visibleTabs.length === 3 ? "grid-cols-3" : "grid-cols-4";

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("sidebar.booking", "Booking")}</h1>
          <p className="text-muted-foreground">Administrer bookinger, lokationer og planlægning</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className={`grid w-full ${gridColsClass} max-w-2xl`}>
            {visibleTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                <tab.icon className="h-4 w-4" />
                {tab.labelKey ? t(tab.labelKey, tab.label) : tab.label}
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
        </Tabs>
      </div>
    </MainLayout>
  );
}