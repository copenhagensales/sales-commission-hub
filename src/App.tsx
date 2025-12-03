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
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
