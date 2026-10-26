import { Samleside } from "@/components/layout/Samleside";
import { useTeamPersonaleSynlighed } from "@/hooks/useTeamPersonaleSynlighed";
import {
  ShiftOverview, AbsenceManagement, TeamGoals, QualityControl, QualityAdmin, PulseSurveyResults,
  CodeOfConductAdmin, CarQuizAdmin, OnboardingDashboard, RampTeam, CoachingTemplates,
  RecruitmentDashboard, RecruitmentCandidates, UpcomingInterviews, UpcomingHires, BookingFlow,
  BookingFlowEngagement, RecruitmentMessages, Referrals, Winback, EmailTemplatesPage, SmsTemplates,
  EmployeeMasterData, UpcomingStarts, CompanyOverview, OnboardingAnalyse, Contracts,
  CareerWishesOverview, SystemEmailTemplates,
} from "@/routes/pages";

export function VagtplanSamleside() {
  const s = useTeamPersonaleSynlighed().vagtplan;
  return (
    <Samleside titel="Vagtplan" faner={[
      { id: "shift-planning", label: "Plan", element: <ShiftOverview />, synlig: s["shift-planning"] },
      { id: "absence", label: "Fravær", element: <AbsenceManagement />, synlig: s.absence },
    ]} />
  );
}

export function MitTeamSamleside() {
  const s = useTeamPersonaleSynlighed().mitTeam;
  return (
    <Samleside titel="Mit team" faner={[
      { id: "team-goals", label: "Teammål", element: <TeamGoals />, synlig: s["team-goals"] },
      { id: "kvalitetskontrol", label: "Kvalitetskontrol", element: <QualityControl />, synlig: s.kvalitetskontrol },
      { id: "administration", label: "Kvalitet: administration", element: <QualityAdmin />, synlig: s.administration },
      { id: "pulse-survey-results", label: "Pulsmåling", element: <PulseSurveyResults />, synlig: s["pulse-survey-results"] },
      { id: "code-of-conduct-admin", label: "Kodeks: overblik", element: <CodeOfConductAdmin />, synlig: s["code-of-conduct-admin"] },
      { id: "car-quiz-admin", label: "Firmabil: overblik", element: <CarQuizAdmin />, synlig: s["car-quiz-admin"] },
    ]} />
  );
}

export function OnboardingSamleside() {
  const s = useTeamPersonaleSynlighed().onboarding;
  return (
    <Samleside titel="Onboarding" ejerAfTab="onboarding-program" faner={[
      { id: "onboarding-program", label: "Program", element: <OnboardingDashboard />, synlig: s["onboarding-program"] },
      { id: "opstartshold", label: "Opstartshold", element: <RampTeam />, synlig: s.opstartshold },
      { id: "coaching-templates", label: "Coaching-skabeloner", element: <CoachingTemplates />, synlig: s["coaching-templates"] },
    ]} />
  );
}

const BOOKING = { id: "booking", label: "Booking" };
const SKABELONER = { id: "skabeloner", label: "Skabeloner" };

export function RekrutteringSamleside() {
  const s = useTeamPersonaleSynlighed().rekruttering;
  return (
    <Samleside titel="Rekruttering" faner={[
      { id: "recruitment", label: "Overblik", element: <RecruitmentDashboard />, synlig: s.recruitment },
      { id: "candidates", label: "Kandidater", element: <RecruitmentCandidates />, synlig: s.candidates },
      { id: "upcoming-interviews", label: "Samtaler", element: <UpcomingInterviews />, synlig: s["upcoming-interviews"] },
      { id: "upcoming-hires", label: "Ansættelser", element: <UpcomingHires />, synlig: s["upcoming-hires"] },
      { id: "booking-flow", label: "Booking", element: <BookingFlow />, synlig: s["booking-flow"], gruppe: BOOKING },
      { id: "engagement", label: "Engagement", element: <BookingFlowEngagement />, synlig: s.engagement, gruppe: BOOKING },
      { id: "messages", label: "Beskeder", element: <RecruitmentMessages />, synlig: s.messages },
      { id: "referrals", label: "Anbefalinger", element: <Referrals />, synlig: s.referrals },
      { id: "winback", label: "Genkontakt", element: <Winback />, synlig: s.winback },
      { id: "email-templates", label: "Mail", element: <EmailTemplatesPage />, synlig: s["email-templates"], gruppe: SKABELONER },
      { id: "sms-templates", label: "SMS", element: <SmsTemplates />, synlig: s["sms-templates"], gruppe: SKABELONER },
    ]} />
  );
}

export function MedarbejdereSamleside() {
  const s = useTeamPersonaleSynlighed().medarbejdere;
  return (
    <Samleside titel="Medarbejdere" ejerAfTab="employees" faner={[
      { id: "employees", label: "Aktive", element: <EmployeeMasterData />, synlig: s.employees },
      { id: "upcoming-starts", label: "Kommende opstarter", element: <UpcomingStarts />, synlig: s["upcoming-starts"] },
      { id: "company-overview", label: "Virksomhedsoverblik", element: <CompanyOverview />, synlig: s["company-overview"] },
      { id: "onboarding-analyse", label: "Onboarding-analyse", element: <OnboardingAnalyse />, synlig: s["onboarding-analyse"] },
    ]} />
  );
}

export function KontrakterSamleside() {
  const s = useTeamPersonaleSynlighed().kontrakter;
  return (
    <Samleside titel="Kontrakter og karriere" faner={[
      { id: "contracts", label: "Kontrakter", element: <Contracts />, synlig: s.contracts },
      { id: "career-wishes-overview", label: "Karriereønsker", element: <CareerWishesOverview />, synlig: s["career-wishes-overview"] },
      { id: "email-templates", label: "Mailskabeloner", element: <SystemEmailTemplates />, synlig: s["email-templates"] },
    ]} />
  );
}
