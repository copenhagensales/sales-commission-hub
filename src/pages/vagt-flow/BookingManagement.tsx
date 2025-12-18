import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, MapPin, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { lazy, Suspense } from "react";

// Lazy load tab contents
const BookWeekContent = lazy(() => import("./BookWeekContent"));
const LocationsContent = lazy(() => import("./LocationsContent"));
const BookingsContent = lazy(() => import("./BookingsContent"));

export default function BookingManagement() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "book-week";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t("sidebar.booking", "Booking")}</h1>
          <p className="text-muted-foreground">Administrer bookinger, lokationer og planlægning</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
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
        </Tabs>
      </div>
    </MainLayout>
  );
}
