import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useOnboardingDays, useEmployeeOnboardingProgress, useCurrentEmployeeId, useUpdateProgress, OnboardingVideo } from "@/hooks/useOnboarding";
import { Play, CheckCircle2, Clock, Target, BookOpen, Dumbbell, PhoneCall } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { VideoPlayerDialog } from "@/components/onboarding/VideoPlayerDialog";
import { DailyMessage } from "@/components/onboarding/DailyMessage";
import { MyProgression } from "@/components/onboarding/MyProgression";

export default function EmployeeOnboardingView() {
  const { data: employeeId } = useCurrentEmployeeId();
  const { data: days = [], isLoading: daysLoading } = useOnboardingDays();
  const { data: progress = [], isLoading: progressLoading } = useEmployeeOnboardingProgress(employeeId || undefined);
  const updateProgress = useUpdateProgress();
  
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<OnboardingVideo | null>(null);

  if (daysLoading || progressLoading) {
    return <div className="text-muted-foreground py-8 text-center">Indlæser onboarding...</div>;
  }

  if (days.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Ingen onboarding-dage oprettet endnu.</p>
        </CardContent>
      </Card>
    );
  }

  const getProgressForDay = (dayId: string) => {
    return progress.find(p => p.onboarding_day_id === dayId);
  };

  const isDayComplete = (dayId: string) => {
    const p = getProgressForDay(dayId);
    return p?.completed_at !== null && p?.completed_at !== undefined;
  };

  const currentDayIndex = days.findIndex(d => !isDayComplete(d.id));
  const currentDay = currentDayIndex >= 0 ? days[currentDayIndex] : null;
  
  const selectedDayData = selectedDay ? days.find(d => d.id === selectedDay) : currentDay;
  const selectedProgress = selectedDayData ? getProgressForDay(selectedDayData.id) : null;

  const handleVideoComplete = async (videoTitle: string) => {
    if (!employeeId || !selectedDayData) return;
    
    const currentVideos = selectedProgress?.videos_completed || [];
    const newVideos = currentVideos.includes(videoTitle)
      ? currentVideos.filter(v => v !== videoTitle)
      : [...currentVideos, videoTitle];
    
    await updateProgress.mutateAsync({
      employeeId,
      dayId: selectedDayData.id,
      updates: { videos_completed: newVideos },
    });
  };

  const handleDrillComplete = async () => {
    if (!employeeId || !selectedDayData) return;
    
    await updateProgress.mutateAsync({
      employeeId,
      dayId: selectedDayData.id,
      updates: { drill_completed: !selectedProgress?.drill_completed },
    });
  };

  const handleCheckout = async (confidence: number) => {
    if (!employeeId || !selectedDayData) return;
    
    const allVideosComplete = selectedDayData.videos.every(v => 
      selectedProgress?.videos_completed?.includes(v.title)
    );
    const drillComplete = selectedProgress?.drill_completed;
    
    if (allVideosComplete && drillComplete) {
      await updateProgress.mutateAsync({
        employeeId,
        dayId: selectedDayData.id,
        updates: { 
          checkout_completed: true,
          checkout_confidence: confidence,
          completed_at: new Date().toISOString(),
        },
      });
    }
  };

  // Group days by week
  const weeks = days.reduce((acc, day) => {
    if (!acc[day.week]) acc[day.week] = [];
    acc[day.week].push(day);
    return acc;
  }, {} as Record<number, typeof days>);

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline Sidebar */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg">Din Fremgang</CardTitle>
          <CardDescription>
            {progress.filter(p => p.completed_at).length} / {days.length} dage gennemført
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(weeks).map(([weekNum, weekDays]) => (
            <div key={weekNum}>
              <h4 className="font-semibold mb-2 text-sm text-muted-foreground">Uge {weekNum}</h4>
              <div className="space-y-2">
                {weekDays.map((day, idx) => {
                  const isComplete = isDayComplete(day.id);
                  const isCurrent = currentDay?.id === day.id;
                  const isSelected = selectedDayData?.id === day.id;
                  
                  return (
                    <button
                      key={day.id}
                      onClick={() => setSelectedDay(day.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                        isSelected ? "bg-primary/10 border border-primary" : "hover:bg-muted",
                        isComplete && "opacity-70"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        isComplete ? "bg-green-500 text-white" : isCurrent ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {isComplete ? <CheckCircle2 className="h-4 w-4" /> : day.day}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{day.focus_title}</p>
                        <p className="text-xs text-muted-foreground">Dag {day.day}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="lg:col-span-2 space-y-4">
        {/* Daily Message */}
        {selectedDayData && (
          <DailyMessage 
            currentWeek={selectedDayData.week} 
            dayMessage={(selectedDayData as any).daily_message}
          />
        )}

        {/* My Progression */}
        {selectedDayData && (
          <MyProgression currentWeek={selectedDayData.week} />
        )}

        {selectedDayData ? (
          <>
            {/* Day Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="outline" className="mb-2">Uge {selectedDayData.week} · Dag {selectedDayData.day}</Badge>
                    <CardTitle>{selectedDayData.focus_title}</CardTitle>
                    {selectedDayData.focus_description && (
                      <CardDescription className="mt-2">{selectedDayData.focus_description}</CardDescription>
                    )}
                  </div>
                  {isDayComplete(selectedDayData.id) && (
                    <Badge className="bg-green-500">Gennemført</Badge>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Videos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Videoer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedDayData.videos.map((video, idx) => {
                  const isWatched = selectedProgress?.videos_completed?.includes(video.title);
                  return (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isWatched}
                          onCheckedChange={() => handleVideoComplete(video.title)}
                        />
                        <div>
                          <p className={cn("font-medium", isWatched && "line-through text-muted-foreground")}>
                            {video.title}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {video.duration_min} min
                          </p>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setPlayingVideo(video)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Se video
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Drill */}
            {selectedDayData.drill_id && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Dumbbell className="h-5 w-5" />
                    Drill: {selectedDayData.drill_title}
                  </CardTitle>
                  <CardDescription>
                    {selectedDayData.drill_duration_min} min øvelse
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedProgress?.drill_completed}
                        onCheckedChange={handleDrillComplete}
                      />
                      <span className={cn(selectedProgress?.drill_completed && "line-through text-muted-foreground")}>
                        Marker som gennemført
                      </span>
                    </div>
                    <Button variant="outline" size="sm">Start Drill</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Call Mission */}
            {selectedDayData.call_mission && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PhoneCall className="h-5 w-5" />
                    Dagens Opkaldsmission
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{selectedDayData.call_mission}</p>
                </CardContent>
              </Card>
            )}

            {/* Checkout */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Checkout
                </CardTitle>
                <CardDescription>
                  Gennemfør alle videoer og drill for at låse op for checkout
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedDayData.checkout_confidence_scale && (
                  <div className="space-y-4">
                    <p className="text-sm">Hvor sikker føler du dig på dagens fokus?</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map(score => (
                        <Button
                          key={score}
                          variant={selectedProgress?.checkout_confidence === score ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleCheckout(score)}
                          disabled={
                            !selectedDayData.videos.every(v => selectedProgress?.videos_completed?.includes(v.title)) ||
                            !selectedProgress?.drill_completed
                          }
                        >
                          {score}
                        </Button>
                      ))}
                    </div>
                    {selectedDayData.checkout_blockers.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground mb-2">Hvad blokerer dig mest?</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedDayData.checkout_blockers.map(blocker => (
                            <Badge key={blocker} variant="outline">{blocker}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Tillykke! Du har gennemført alle onboarding-dage.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>

    {/* Video Player Dialog */}
    <VideoPlayerDialog
      open={!!playingVideo}
      onOpenChange={(open) => !open && setPlayingVideo(null)}
      videoTitle={playingVideo?.title || ""}
      videoUrl={playingVideo?.video_url}
    />
    </div>
  );
}
