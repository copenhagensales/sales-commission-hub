import { OnboardingHeroSection } from "./OnboardingHeroSection";
import { OnboardingJourneyColumn } from "./OnboardingJourneyColumn";
import { OnboardingProgressionColumn } from "./OnboardingProgressionColumn";
import { OnboardingFocusColumn } from "./OnboardingFocusColumn";
import { OnboardingRampChart } from "./OnboardingRampChart";
import { OnboardingDay, EmployeeProgress } from "@/hooks/useOnboarding";

interface OnboardingStatusBoardProps {
  days: OnboardingDay[];
  progress: EmployeeProgress[];
  currentWeek: number;
  // Optional metrics - can be connected to real data later
  callsPerWeek?: number;
  conversationsPerWeek?: number;
  meetingsBookedPerWeek?: number;
  callToMeetingRate?: number;
  meetingToOrderRate?: number;
  monthlyRevenue?: number;
  rampTarget?: number;
  actualRevenueHistory?: number[];
}

export function OnboardingStatusBoard({
  days,
  progress,
  currentWeek,
  callsPerWeek = 180,
  conversationsPerWeek = 45,
  meetingsBookedPerWeek = 8,
  callToMeetingRate = 4.4,
  meetingToOrderRate = 25,
  monthlyRevenue = 20000,
  rampTarget = 35000,
  actualRevenueHistory = [20000],
}: OnboardingStatusBoardProps) {
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <OnboardingHeroSection />

      {/* Progression & Future Scenario - Right after hero */}
      <OnboardingRampChart 
        currentWeek={currentWeek}
        actualRevenue={actualRevenueHistory}
        currentDailyCalls={Math.round(callsPerWeek / 5)}
        currentMeetingsPerWeek={meetingsBookedPerWeek}
        currentOrdersPerWeek={Math.round(meetingsBookedPerWeek * (meetingToOrderRate / 100))}
      />

      {/* Three Column Status Board */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <OnboardingJourneyColumn 
          days={days} 
          progress={progress} 
        />
        <OnboardingProgressionColumn 
          currentWeek={currentWeek}
          callsPerWeek={callsPerWeek}
          conversationsPerWeek={conversationsPerWeek}
          meetingsBookedPerWeek={meetingsBookedPerWeek}
          callToMeetingRate={callToMeetingRate}
          meetingToOrderRate={meetingToOrderRate}
          monthlyRevenue={monthlyRevenue}
          rampTarget={rampTarget}
        />
        <OnboardingFocusColumn 
          currentWeek={currentWeek}
        />
      </div>
    </div>
  );
}
