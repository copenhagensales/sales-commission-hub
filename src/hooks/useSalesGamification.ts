import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { checkAchievements, type AchievementCheckData } from "@/lib/gamification-achievements";
import { getProgressToNextLevel } from "@/lib/gamification-levels";
import { getPerformanceStatus, getRandomQuote } from "@/lib/gamification-quotes";

interface UseSalesGamificationProps {
  employeeId: string;
  currentPeriodTotal: number;
  targetAmount: number;
  progressPercent: number;
  isAhead: boolean;
  isOnTrack: boolean;
  daysPassedInPeriod: number;
  totalDaysInPeriod: number;
  dailyTarget: number;
  todayTotal: number;
}

export function useSalesGamification({
  employeeId,
  currentPeriodTotal,
  targetAmount,
  progressPercent,
  isAhead,
  isOnTrack,
  daysPassedInPeriod,
  totalDaysInPeriod,
  dailyTarget,
  todayTotal,
}: UseSalesGamificationProps) {
  const queryClient = useQueryClient();

  // Fetch streak data
  const { data: streakData } = useQuery({
    queryKey: ["sales-streak", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_sales_streaks")
        .select("*")
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  // Fetch achievements
  const { data: achievements } = useQuery({
    queryKey: ["sales-achievements", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_sales_achievements")
        .select("*")
        .eq("employee_id", employeeId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
  });

  // Fetch personal records
  const { data: records } = useQuery({
    queryKey: ["sales-records", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_sales_records")
        .select("*")
        .eq("employee_id", employeeId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
  });

  // Fetch level data
  const { data: levelData } = useQuery({
    queryKey: ["sales-level", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_sales_levels")
        .select("*")
        .eq("employee_id", employeeId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  // Update streak mutation
  const updateStreakMutation = useMutation({
    mutationFn: async (hitDailyGoal: boolean) => {
      const today = new Date().toISOString().split("T")[0];
      
      if (streakData) {
        const lastDate = streakData.last_streak_date;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        
        let newStreak = streakData.current_streak;
        let newLongest = streakData.longest_streak;
        let newTotal = streakData.total_streak_days;
        
        if (hitDailyGoal) {
          if (lastDate === yesterdayStr || lastDate === today) {
            newStreak = lastDate === today ? newStreak : newStreak + 1;
          } else {
            newStreak = 1;
          }
          if (lastDate !== today) {
            newTotal = newTotal + 1;
          }
          newLongest = Math.max(newLongest, newStreak);
        } else if (lastDate !== today && lastDate !== yesterdayStr) {
          newStreak = 0;
        }
        
        const { error } = await supabase
          .from("employee_sales_streaks")
          .update({
            current_streak: newStreak,
            longest_streak: newLongest,
            total_streak_days: newTotal,
            last_streak_date: today,
          })
          .eq("id", streakData.id);
        
        if (error) throw error;
      } else if (hitDailyGoal) {
        const { error } = await supabase
          .from("employee_sales_streaks")
          .insert({
            employee_id: employeeId,
            current_streak: 1,
            longest_streak: 1,
            total_streak_days: 1,
            last_streak_date: today,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-streak", employeeId] });
    },
  });

  // Unlock achievement mutation
  const unlockAchievementMutation = useMutation({
    mutationFn: async (achievementType: string) => {
      const { error } = await supabase
        .from("employee_sales_achievements")
        .insert({
          employee_id: employeeId,
          achievement_type: achievementType,
        });
      
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-achievements", employeeId] });
    },
  });

  // Update record mutation
  const updateRecordMutation = useMutation({
    mutationFn: async ({ 
      recordType, 
      recordValue, 
      periodReference 
    }: { 
      recordType: string; 
      recordValue: number; 
      periodReference: string;
    }) => {
      const existingRecord = records?.find(r => r.record_type === recordType);
      
      if (existingRecord) {
        if (recordValue > existingRecord.record_value) {
          const { error } = await supabase
            .from("employee_sales_records")
            .update({
              record_value: recordValue,
              achieved_at: new Date().toISOString().split("T")[0],
              period_reference: periodReference,
            })
            .eq("id", existingRecord.id);
          
          if (error) throw error;
          return { isNewRecord: true };
        }
      } else {
        const { error } = await supabase
          .from("employee_sales_records")
          .insert({
            employee_id: employeeId,
            record_type: recordType,
            record_value: recordValue,
            achieved_at: new Date().toISOString().split("T")[0],
            period_reference: periodReference,
          });
        
        if (error) throw error;
        return { isNewRecord: true };
      }
      return { isNewRecord: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-records", employeeId] });
    },
  });

  // Update level mutation
  const updateLevelMutation = useMutation({
    mutationFn: async (totalEarned: number) => {
      const levelProgress = getProgressToNextLevel(totalEarned);
      
      if (levelData) {
        const { error } = await supabase
          .from("employee_sales_levels")
          .update({
            total_earned: totalEarned,
            current_level: levelProgress.current.level,
          })
          .eq("id", levelData.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employee_sales_levels")
          .insert({
            employee_id: employeeId,
            total_earned: totalEarned,
            current_level: levelProgress.current.level,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-level", employeeId] });
    },
  });

  // Computed values
  const currentStreak = streakData?.current_streak || 0;
  const longestStreak = streakData?.longest_streak || 0;
  const unlockedAchievementIds = achievements?.map(a => a.achievement_type) || [];
  
  const levelProgress = useMemo(() => {
    const totalEarned = levelData?.total_earned || 0;
    return getProgressToNextLevel(totalEarned);
  }, [levelData]);

  const performanceStatus = useMemo(() => {
    return getPerformanceStatus(progressPercent, isAhead, isOnTrack);
  }, [progressPercent, isAhead, isOnTrack]);

  const motivationalQuote = useMemo(() => {
    return getRandomQuote(performanceStatus);
  }, [performanceStatus]);

  // Check for new achievements
  const achievementCheckData: AchievementCheckData = useMemo(() => ({
    hasSetGoal: targetAmount > 0,
    progressPercent,
    isAhead,
    currentStreak,
    longestStreak,
    daysPassedInPeriod,
    totalDaysInPeriod,
    currentPeriodTotal,
    exceededGoalBy10Percent: progressPercent >= 110,
  }), [targetAmount, progressPercent, isAhead, currentStreak, longestStreak, daysPassedInPeriod, totalDaysInPeriod, currentPeriodTotal]);

  const potentialAchievements = useMemo(() => {
    return checkAchievements(achievementCheckData);
  }, [achievementCheckData]);

  const newAchievements = useMemo(() => {
    return potentialAchievements.filter(id => !unlockedAchievementIds.includes(id));
  }, [potentialAchievements, unlockedAchievementIds]);

  // Get records by type
  const bestDayRecord = records?.find(r => r.record_type === "best_day");
  const bestWeekRecord = records?.find(r => r.record_type === "best_week");
  const bestMonthRecord = records?.find(r => r.record_type === "best_month");

  // Check if today hit daily target
  const hitDailyGoal = todayTotal >= dailyTarget;

  // Streak status
  const streakAtRisk = currentStreak > 0 && !hitDailyGoal;

  return {
    // Streak
    currentStreak,
    longestStreak,
    totalStreakDays: streakData?.total_streak_days || 0,
    hitDailyGoal,
    streakAtRisk,
    updateStreak: updateStreakMutation.mutate,

    // Achievements
    unlockedAchievementIds,
    newAchievements,
    unlockAchievement: unlockAchievementMutation.mutate,

    // Records
    bestDayRecord,
    bestWeekRecord,
    bestMonthRecord,
    updateRecord: updateRecordMutation.mutate,

    // Level
    levelProgress,
    totalEarned: levelData?.total_earned || 0,
    updateLevel: updateLevelMutation.mutate,

    // Quotes
    performanceStatus,
    motivationalQuote,
  };
}
