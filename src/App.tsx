import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { Component, ErrorInfo, ReactNode, Suspense, lazy } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ProtectedRoute, RoleProtectedRoute } from "@/components/RoleProtectedRoute";

// Lazy load all pages to prevent import errors from breaking the entire app
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Agents = lazy(() => import("./pages/Agents"));
const Sales = lazy(() => import("./pages/Sales"));
const Payroll = lazy(() => import("./pages/Payroll"));
const Wallboard = lazy(() => import("./pages/Wallboard"));
const Settings = lazy(() => import("./pages/Settings"));
const Commission = lazy(() => import("./pages/Commission"));
const MgTest = lazy(() => import("./pages/MgTest"));
const KmTest = lazy(() => import("./pages/KmTest"));
const Codan = lazy(() => import("./pages/Codan"));
const TdcErhverv = lazy(() => import("./pages/TdcErhverv"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdversusData = lazy(() => import("./pages/AdversusData"));
const Logikker = lazy(() => import("./pages/Logikker"));
const EmployeeMasterData = lazy(() => import("./pages/EmployeeMasterData"));
const EmployeeDetail = lazy(() => import("./pages/EmployeeDetail"));
const EmployeeOnboarding = lazy(() => import("./pages/EmployeeOnboarding"));
const Teams = lazy(() => import("./pages/Teams"));
// Vagt-flow pages
const VagtFlowIndex = lazy(() => import("./pages/vagt-flow/Index"));
const VagtBookWeek = lazy(() => import("./pages/vagt-flow/BookWeek"));
const VagtLocations = lazy(() => import("./pages/vagt-flow/Locations"));
const VagtBookings = lazy(() => import("./pages/vagt-flow/Bookings"));
const VagtMinUge = lazy(() => import("./pages/vagt-flow/MinUge"));
const VagtEmployees = lazy(() => import("./pages/vagt-flow/Employees"));
const VagtVehicles = lazy(() => import("./pages/vagt-flow/Vehicles"));
const VagtTimeOffRequests = lazy(() => import("./pages/vagt-flow/TimeOffRequests"));
const VagtLocationDetail = lazy(() => import("./pages/vagt-flow/LocationDetail"));
const VagtBilling = lazy(() => import("./pages/vagt-flow/Billing"));
// Shift planning pages (internal)
const ShiftOverview = lazy(() => import("./pages/shift-planning/ShiftOverview"));
const MySchedule = lazy(() => import("./pages/shift-planning/MySchedule"));
const AbsenceManagement = lazy(() => import("./pages/shift-planning/AbsenceManagement"));
const TimeTracking = lazy(() => import("./pages/shift-planning/TimeTracking"));
// Contract pages
const Contracts = lazy(() => import("./pages/Contracts"));
const MyContracts = lazy(() => import("./pages/MyContracts"));
const ContractSign = lazy(() => import("./pages/ContractSign"));
const PulseSurvey = lazy(() => import("./pages/PulseSurvey"));
const PulseSurveyResults = lazy(() => import("./pages/PulseSurveyResults"));
const Admin = lazy(() => import("./pages/Admin"));
const MyProfile = lazy(() => import("./pages/MyProfile"));
const CareerWishes = lazy(() => import("./pages/CareerWishes"));
const CareerWishesOverview = lazy(() => import("./pages/CareerWishesOverview"));
const CarQuiz = lazy(() => import("./pages/CarQuiz"));
const CarQuizAdmin = lazy(() => import("./pages/CarQuizAdmin"));
const CodeOfConduct = lazy(() => import("./pages/CodeOfConduct"));
const CodeOfConductAdmin = lazy(() => import("./pages/CodeOfConductAdmin"));
const ExtraWork = lazy(() => import("./pages/ExtraWork"));
const ExtraWorkAdmin = lazy(() => import("./pages/ExtraWorkAdmin"));

const queryClient = new QueryClient();

// Error Boundary to catch rendering errors
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-lg border border-slate-700">
            <h1 className="text-xl font-bold text-white mb-2">Der opstod en fejl</h1>
            <p className="text-slate-300 mb-4">Noget gik galt under indlæsning af appen.</p>
            <pre className="text-sm text-red-400 bg-slate-900 p-3 rounded overflow-auto max-h-40">
              {this.state.error?.message}
            </pre>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Genindlæs side
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading fallback component
function PageLoader() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-foreground">Indlæser...</div>
    </div>
  );
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <PageLoader />;
  }
  
  if (user) {
    return <Navigate to="/my-schedule" replace />;
  }
  
  return <>{children}</>;
}

// Smart redirect based on role
function SmartRedirect() {
  const { user, loading } = useAuth();
  const [redirectPath, setRedirectPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function checkRole() {
      if (!user) {
        setRedirectPath("/auth");
        return;
      }
      
      try {
        // Check if user is teamleder or owner - use static import
        const { supabase } = await import("@/integrations/supabase/client");
        const { data, error } = await supabase
          .from("system_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (error) {
          console.error("Error checking role:", error);
          setRedirectPath("/my-schedule");
          return;
        }
        
        if (data?.role === "teamleder" || data?.role === "ejer") {
          setRedirectPath("/shift-planning");
        } else {
          setRedirectPath("/my-schedule");
        }
      } catch (err) {
        console.error("Error in role check:", err);
        setRedirectPath("/my-schedule");
      }
    }
    
    if (!loading) {
      checkRole();
    }
  }, [user, loading]);

  if (loading || !redirectPath) {
    return <PageLoader />;
  }

  return <Navigate to={redirectPath} replace />;
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<SmartRedirect />} />
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
              <Route path="/teams" element={<RoleProtectedRoute requireTeamlederOrAbove><Teams /></RoleProtectedRoute>} />
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
              {/* Extra work routes */}
              <Route path="/extra-work" element={<ProtectedRoute><ExtraWork /></ProtectedRoute>} />
              <Route path="/extra-work-admin" element={<RoleProtectedRoute requireTeamlederOrAbove><ExtraWorkAdmin /></RoleProtectedRoute>} />
              {/* Contract routes */}
              <Route path="/contracts" element={<RoleProtectedRoute requireTeamlederOrAbove><Contracts /></RoleProtectedRoute>} />
              {/* Pulse survey results - teamleder+ */}
              <Route path="/pulse-survey-results" element={<RoleProtectedRoute requireTeamlederOrAbove><PulseSurveyResults /></RoleProtectedRoute>} />
              <Route path="/career-wishes-overview" element={<RoleProtectedRoute requireTeamlederOrAbove><CareerWishesOverview /></RoleProtectedRoute>} />
              <Route path="/car-quiz-admin" element={<RoleProtectedRoute requireTeamlederOrAbove><CarQuizAdmin /></RoleProtectedRoute>} />
              <Route path="/code-of-conduct-admin" element={<RoleProtectedRoute requireTeamlederOrAbove><CodeOfConductAdmin /></RoleProtectedRoute>} />
              {/* Admin route - owner only */}
              <Route path="/admin" element={<RoleProtectedRoute requiredRole="ejer"><Admin /></RoleProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;