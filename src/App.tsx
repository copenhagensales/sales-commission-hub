import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute, RoleProtectedRoute } from "@/components/RoleProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import Sales from "./pages/Sales";
import Payroll from "./pages/Payroll";
import Wallboard from "./pages/Wallboard";
import Settings from "./pages/Settings";
import Commission from "./pages/Commission";
import MgTest from "./pages/MgTest";
import KmTest from "./pages/KmTest";
import Codan from "./pages/Codan";
import TdcErhverv from "./pages/TdcErhverv";
import NotFound from "./pages/NotFound";
import AdversusData from "./pages/AdversusData";
import Logikker from "./pages/Logikker";
import EmployeeMasterData from "./pages/EmployeeMasterData";
import EmployeeDetail from "./pages/EmployeeDetail";
import EmployeeOnboarding from "./pages/EmployeeOnboarding";
// Vagt-flow pages
import VagtFlowIndex from "./pages/vagt-flow/Index";
import VagtBookWeek from "./pages/vagt-flow/BookWeek";
import VagtLocations from "./pages/vagt-flow/Locations";
import VagtBookings from "./pages/vagt-flow/Bookings";
import VagtMinUge from "./pages/vagt-flow/MinUge";
import VagtEmployees from "./pages/vagt-flow/Employees";
import VagtVehicles from "./pages/vagt-flow/Vehicles";
import VagtTimeOffRequests from "./pages/vagt-flow/TimeOffRequests";
import VagtLocationDetail from "./pages/vagt-flow/LocationDetail";
import VagtBilling from "./pages/vagt-flow/Billing";
// Shift planning pages (internal)
import ShiftOverview from "./pages/shift-planning/ShiftOverview";
import MySchedule from "./pages/shift-planning/MySchedule";
import AbsenceManagement from "./pages/shift-planning/AbsenceManagement";
import TimeTracking from "./pages/shift-planning/TimeTracking";
// Contract pages
import Contracts from "./pages/Contracts";
import MyContracts from "./pages/MyContracts";
import ContractSign from "./pages/ContractSign";
import PulseSurvey from "./pages/PulseSurvey";
import PulseSurveyResults from "./pages/PulseSurveyResults";
import Admin from "./pages/Admin";
import MyProfile from "./pages/MyProfile";
import CareerWishes from "./pages/CareerWishes";
import CareerWishesOverview from "./pages/CareerWishesOverview";
import CarQuiz from "./pages/CarQuiz";
import CarQuizAdmin from "./pages/CarQuizAdmin";
import CodeOfConduct from "./pages/CodeOfConduct";

const queryClient = new QueryClient();

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/my-schedule" replace />;
  }
  
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/my-schedule" replace />} />
          <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
          <Route path="/onboarding" element={<EmployeeOnboarding />} />
          {/* Employee accessible routes */}
          <Route path="/my-schedule" element={<ProtectedRoute><MySchedule /></ProtectedRoute>} />
          <Route path="/my-profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
          <Route path="/my-contracts" element={<ProtectedRoute><MyContracts /></ProtectedRoute>} />
          <Route path="/pulse-survey" element={<ProtectedRoute><PulseSurvey /></ProtectedRoute>} />
          <Route path="/career-wishes" element={<ProtectedRoute><CareerWishes /></ProtectedRoute>} />
          <Route path="/car-quiz" element={<ProtectedRoute><CarQuiz /></ProtectedRoute>} />
          <Route path="/code-of-conduct" element={<ProtectedRoute><CodeOfConduct /></ProtectedRoute>} />
          <Route path="/contract/:id" element={<ContractSign />} />
          {/* Teamleder+ routes */}
          <Route path="/dashboard" element={<RoleProtectedRoute requireTeamlederOrAbove><Dashboard /></RoleProtectedRoute>} />
          <Route path="/agents" element={<RoleProtectedRoute requireTeamlederOrAbove><Agents /></RoleProtectedRoute>} />
          <Route path="/sales" element={<RoleProtectedRoute requireTeamlederOrAbove><Sales /></RoleProtectedRoute>} />
          <Route path="/codan" element={<RoleProtectedRoute requireTeamlederOrAbove><Codan /></RoleProtectedRoute>} />
          <Route path="/tdc-erhverv" element={<RoleProtectedRoute requireTeamlederOrAbove><TdcErhverv /></RoleProtectedRoute>} />
          <Route path="/commission-cpo" element={<RoleProtectedRoute requireTeamlederOrAbove><Commission /></RoleProtectedRoute>} />
          <Route path="/payroll" element={<RoleProtectedRoute requireTeamlederOrAbove><Payroll /></RoleProtectedRoute>} />
          <Route path="/wallboard" element={<Wallboard />} />
          <Route path="/mg-test" element={<RoleProtectedRoute requireTeamlederOrAbove><MgTest /></RoleProtectedRoute>} />
          <Route path="/km-test" element={<RoleProtectedRoute requireTeamlederOrAbove><KmTest /></RoleProtectedRoute>} />
          <Route path="/adversus-data" element={<RoleProtectedRoute requireTeamlederOrAbove><AdversusData /></RoleProtectedRoute>} />
          <Route path="/logikker" element={<RoleProtectedRoute requireTeamlederOrAbove><Logikker /></RoleProtectedRoute>} />
          <Route path="/employees" element={<RoleProtectedRoute requireTeamlederOrAbove><EmployeeMasterData /></RoleProtectedRoute>} />
          <Route path="/employees/:id" element={<RoleProtectedRoute requireTeamlederOrAbove><EmployeeDetail /></RoleProtectedRoute>} />
          <Route path="/settings" element={<RoleProtectedRoute requireTeamlederOrAbove><Settings /></RoleProtectedRoute>} />
          {/* Vagt-flow routes - teamleder+ */}
          <Route path="/vagt-flow" element={<RoleProtectedRoute requireTeamlederOrAbove><VagtFlowIndex /></RoleProtectedRoute>} />
          <Route path="/vagt-flow/book-week" element={<RoleProtectedRoute requireTeamlederOrAbove><VagtBookWeek /></RoleProtectedRoute>} />
          <Route path="/vagt-flow/locations" element={<RoleProtectedRoute requireTeamlederOrAbove><VagtLocations /></RoleProtectedRoute>} />
          <Route path="/vagt-flow/locations/:id" element={<RoleProtectedRoute requireTeamlederOrAbove><VagtLocationDetail /></RoleProtectedRoute>} />
          <Route path="/vagt-flow/bookings" element={<RoleProtectedRoute requireTeamlederOrAbove><VagtBookings /></RoleProtectedRoute>} />
          <Route path="/vagt-flow/min-uge" element={<ProtectedRoute><VagtMinUge /></ProtectedRoute>} />
          <Route path="/vagt-flow/employees" element={<RoleProtectedRoute requireTeamlederOrAbove><VagtEmployees /></RoleProtectedRoute>} />
          <Route path="/vagt-flow/vehicles" element={<RoleProtectedRoute requireTeamlederOrAbove><VagtVehicles /></RoleProtectedRoute>} />
          <Route path="/vagt-flow/time-off" element={<RoleProtectedRoute requireTeamlederOrAbove><VagtTimeOffRequests /></RoleProtectedRoute>} />
          <Route path="/vagt-flow/billing" element={<RoleProtectedRoute requireTeamlederOrAbove><VagtBilling /></RoleProtectedRoute>} />
          {/* Shift planning routes */}
          <Route path="/shift-planning" element={<RoleProtectedRoute requireTeamlederOrAbove><ShiftOverview /></RoleProtectedRoute>} />
          <Route path="/shift-planning/my-schedule" element={<ProtectedRoute><MySchedule /></ProtectedRoute>} />
          <Route path="/shift-planning/absence" element={<RoleProtectedRoute requireTeamlederOrAbove><AbsenceManagement /></RoleProtectedRoute>} />
          <Route path="/shift-planning/time-tracking" element={<RoleProtectedRoute requireTeamlederOrAbove><TimeTracking /></RoleProtectedRoute>} />
          {/* Contract routes */}
          <Route path="/contracts" element={<RoleProtectedRoute requireTeamlederOrAbove><Contracts /></RoleProtectedRoute>} />
          {/* Pulse survey results - teamleder+ */}
          <Route path="/pulse-survey-results" element={<RoleProtectedRoute requireTeamlederOrAbove><PulseSurveyResults /></RoleProtectedRoute>} />
          <Route path="/career-wishes-overview" element={<RoleProtectedRoute requireTeamlederOrAbove><CareerWishesOverview /></RoleProtectedRoute>} />
          <Route path="/car-quiz-admin" element={<RoleProtectedRoute requireTeamlederOrAbove><CarQuizAdmin /></RoleProtectedRoute>} />
          {/* Admin route - owner only */}
          <Route path="/admin" element={<RoleProtectedRoute requiredRole="ejer"><Admin /></RoleProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
