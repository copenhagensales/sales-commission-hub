import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Indlæser...</div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
}

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
    return <Navigate to="/dashboard" replace />;
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
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
          <Route path="/onboarding" element={<EmployeeOnboarding />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/agents" element={<ProtectedRoute><Agents /></ProtectedRoute>} />
          <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
          <Route path="/codan" element={<ProtectedRoute><Codan /></ProtectedRoute>} />
          <Route path="/tdc-erhverv" element={<ProtectedRoute><TdcErhverv /></ProtectedRoute>} />
          <Route path="/commission-cpo" element={<ProtectedRoute><Commission /></ProtectedRoute>} />
          <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
          <Route path="/wallboard" element={<Wallboard />} />
          <Route path="/mg-test" element={<ProtectedRoute><MgTest /></ProtectedRoute>} />
          <Route path="/km-test" element={<ProtectedRoute><KmTest /></ProtectedRoute>} />
          <Route path="/adversus-data" element={<ProtectedRoute><AdversusData /></ProtectedRoute>} />
          <Route path="/logikker" element={<ProtectedRoute><Logikker /></ProtectedRoute>} />
          <Route path="/employees" element={<ProtectedRoute><EmployeeMasterData /></ProtectedRoute>} />
          <Route path="/employees/:id" element={<ProtectedRoute><EmployeeDetail /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          {/* Vagt-flow routes */}
          <Route path="/vagt-flow" element={<ProtectedRoute><VagtFlowIndex /></ProtectedRoute>} />
          <Route path="/vagt-flow/book-week" element={<ProtectedRoute><VagtBookWeek /></ProtectedRoute>} />
          <Route path="/vagt-flow/locations" element={<ProtectedRoute><VagtLocations /></ProtectedRoute>} />
          <Route path="/vagt-flow/locations/:id" element={<ProtectedRoute><VagtLocationDetail /></ProtectedRoute>} />
          <Route path="/vagt-flow/bookings" element={<ProtectedRoute><VagtBookings /></ProtectedRoute>} />
          <Route path="/vagt-flow/min-uge" element={<ProtectedRoute><VagtMinUge /></ProtectedRoute>} />
          <Route path="/vagt-flow/employees" element={<ProtectedRoute><VagtEmployees /></ProtectedRoute>} />
          <Route path="/vagt-flow/vehicles" element={<ProtectedRoute><VagtVehicles /></ProtectedRoute>} />
          <Route path="/vagt-flow/time-off" element={<ProtectedRoute><VagtTimeOffRequests /></ProtectedRoute>} />
          <Route path="/vagt-flow/billing" element={<ProtectedRoute><VagtBilling /></ProtectedRoute>} />
          {/* Shift planning routes (internal) */}
          <Route path="/shift-planning" element={<ProtectedRoute><ShiftOverview /></ProtectedRoute>} />
          <Route path="/shift-planning/my-schedule" element={<ProtectedRoute><MySchedule /></ProtectedRoute>} />
          <Route path="/shift-planning/absence" element={<ProtectedRoute><AbsenceManagement /></ProtectedRoute>} />
          <Route path="/shift-planning/time-tracking" element={<ProtectedRoute><TimeTracking /></ProtectedRoute>} />
          {/* Contract routes */}
          <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
          <Route path="/my-contracts" element={<ProtectedRoute><MyContracts /></ProtectedRoute>} />
          <Route path="/contract/:id" element={<ContractSign />} />
          {/* Admin route */}
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
