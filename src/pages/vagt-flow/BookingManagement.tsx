import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, ListChecks, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { lazy, Suspense } from "react";

// Lazy load tab contents
const BookWeekContent = lazy(() => import("./BookWeekContent"));
const LocationsContent = lazy(() => import("./LocationsContent"));
const BookingsContent = lazy(() => import("./BookingsContent"));
const VagtplanFMContent = lazy(() => import("./VagtplanFMContent"));

export default function BookingManagement() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "book-week";
  const weekParam = searchParams.get("week");
  const yearParam = searchParams.get("year");

  const handleTabChange = (value: string) => {
    // Preserve week/year params when changing tabs
    const params: Record<string, string> = { tab: value };
    if (weekParam) params.week = weekParam;
    if (yearParam) params.year = yearParam;
    setSearchParams(params);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("sidebar.booking", "Booking")}</h1>
          <p className="text-muted-foreground">Administrer bookinger, lokationer og planlægning</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="book-week" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t("sidebar.bookWeek", "Book uge")}
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Kommende bookinger
            </TabsTrigger>
            <TabsTrigger value="locations" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {t("sidebar.locations", "Lokationer")}
            </TabsTrigger>
            <TabsTrigger value="vagtplan-fm" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Vagtplan FM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="book-week" className="mt-6">
            <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
              <BookWeekContent />
            </Suspense>
          </TabsContent>

          <TabsContent value="bookings" className="mt-6">
            <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
              <BookingsContent />
            </Suspense>
          </TabsContent>

          <TabsContent value="locations" className="mt-6">
            <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
              <LocationsContent />
            </Suspense>
          </TabsContent>

          <TabsContent value="vagtplan-fm" className="mt-6">
            <Suspense fallback={<div className="flex items-center justify-center py-12">Indlæser...</div>}>
              <VagtplanFMContent />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
