import { useState } from "react";
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { addWeeks, subWeeks, format, startOfWeek, endOfWeek } from "date-fns";
import { da } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Settings, Plus, Video, ImageIcon, SquareStack } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SomeProgressCard } from "@/components/some/SomeProgressCard";
import { SomeKanbanColumn } from "@/components/some/SomeKanbanColumn";
import { AddContentDialog } from "@/components/some/AddContentDialog";
import { SomeGoalsSettings } from "@/components/some/SomeGoalsSettings";
import { SomeWeeklyMetricsCard } from "@/components/some/SomeWeeklyMetricsCard";
import { SomeMetricsChart } from "@/components/some/SomeMetricsChart";
import { SomeOverallProgress } from "@/components/some/SomeOverallProgress";
import { useSomeContent, getWeekStartDate, ContentItem, ContentStatus, ContentType } from "@/hooks/useSomeContent";
import { useSomeMetrics } from "@/hooks/useSomeMetrics";

const statusColumns: { status: ContentStatus; title: string }[] = [
  { status: "planned", title: "Planlagt" },
  { status: "filmed", title: "Filmet" },
  { status: "edited", title: "Redigeret" },
  { status: "published", title: "Publiceret" },
];

export default function Some() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const weekStartDate = getWeekStartDate(selectedDate);
  const previousWeekStartDate = getWeekStartDate(subWeeks(new Date(weekStartDate), 1));
  const weekEnd = endOfWeek(new Date(weekStartDate), { weekStartsOn: 1 });
  
  const {
    contentItems,
    defaultGoals,
    isLoading,
    progress,
    createItem,
    updateItem,
    deleteItem,
    updateDefaultGoals,
  } = useSomeContent(weekStartDate);

  const {
    currentMetrics,
    previousMetrics,
    historicalMetrics,
    upsertMetrics,
  } = useSomeMetrics(weekStartDate, previousWeekStartDate);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [defaultType, setDefaultType] = useState<ContentType>("tiktok_video");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    const newStatus = over.id as ContentStatus;
    
    const item = contentItems.find((i) => i.id === itemId);
    if (item && item.status !== newStatus) {
      updateItem({ id: itemId, status: newStatus });
    }
  };

  const handleAddClick = (type: ContentType) => {
    setDefaultType(type);
    setEditItem(null);
    setAddDialogOpen(true);
  };

  const handleEditClick = (item: ContentItem) => {
    setEditItem(item);
    setDefaultType(item.type);
    setAddDialogOpen(true);
  };

  const goToPreviousWeek = () => setSelectedDate(subWeeks(selectedDate, 1));
  const goToNextWeek = () => setSelectedDate(addWeeks(selectedDate, 1));
  const goToCurrentWeek = () => setSelectedDate(new Date());


  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">SOME Content</h1>
          <p className="text-muted-foreground">Planlæg og track dit sociale medie indhold</p>
        </div>
        
        {/* Week navigation */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[200px]">
              <p className="font-semibold">
                Uge {format(new Date(weekStartDate), "w", { locale: da })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(weekStartDate), "d. MMM", { locale: da })} – {format(weekEnd, "d. MMM yyyy", { locale: da })}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={goToNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToCurrentWeek}>
              I dag
            </Button>
          </div>
          
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Mål
          </Button>
        </div>

        {/* Progress cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {/* Overall Progress */}
            <SomeOverallProgress
              tiktokDone={progress.tiktok.done}
              tiktokTarget={progress.tiktok.target}
              storiesDone={progress.stories.done}
              storiesTarget={progress.stories.target}
              postsDone={progress.posts.done}
              postsTarget={progress.posts.target}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SomeProgressCard
                title="TikTok videoer"
                icon={<Video className="h-4 w-4 text-white" />}
                done={progress.tiktok.done}
                target={progress.tiktok.target}
                color="bg-black"
              />
              <SomeProgressCard
                title="Insta Stories"
                icon={<SquareStack className="h-4 w-4 text-white" />}
                done={progress.stories.done}
                target={progress.stories.target}
                color="bg-gradient-to-r from-purple-500 to-pink-500"
              />
              <SomeProgressCard
                title="Insta Posts"
                icon={<ImageIcon className="h-4 w-4 text-white" />}
                done={progress.posts.done}
                target={progress.posts.target}
                color="bg-gradient-to-r from-amber-500 to-orange-500"
              />
            </div>
          </>
        )}

        {/* Quick add buttons */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleAddClick("tiktok_video")} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            TikTok video
          </Button>
          <Button onClick={() => handleAddClick("insta_story")} size="sm" variant="secondary">
            <Plus className="h-4 w-4 mr-1" />
            Insta story
          </Button>
          <Button onClick={() => handleAddClick("insta_post")} size="sm" variant="secondary">
            <Plus className="h-4 w-4 mr-1" />
            Insta post
          </Button>
        </div>

        {/* Kanban board */}
        <div className="overflow-x-auto pb-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 min-w-max">
              {statusColumns.map(({ status, title }) => (
                <SomeKanbanColumn
                  key={status}
                  status={status}
                  title={title}
                  items={contentItems.filter((item) => item.status === status)}
                  onEdit={handleEditClick}
                  onDelete={deleteItem}
                />
              ))}
            </div>
          </DndContext>
        </div>

        {/* Weekly Metrics Section */}
        <SomeWeeklyMetricsCard
          weekStartDate={weekStartDate}
          currentMetrics={currentMetrics}
          previousMetrics={previousMetrics}
          onSave={upsertMetrics}
        />

        {/* Metrics Chart */}
        <SomeMetricsChart historicalMetrics={historicalMetrics} />
      </div>

      <AddContentDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        weekStartDate={weekStartDate}
        editItem={editItem}
        onSave={createItem}
        onUpdate={updateItem}
        defaultType={defaultType}
      />

      <SomeGoalsSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        goals={defaultGoals}
        onSave={updateDefaultGoals}
      />
    </MainLayout>
  );
}
