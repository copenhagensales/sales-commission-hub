import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AppRouter } from "@/routes/AppRouter";
import { RolePreviewProvider } from "@/contexts/RolePreviewContext";
const TwilioDeviceProvider = React.lazy(() => import("@/contexts/TwilioDeviceContext").then(m => ({ default: m.TwilioDeviceProvider })));
import { SessionTimeoutProvider } from "@/contexts/SessionTimeoutContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute - reduce unnecessary refetches
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
      retry: (failureCount, error) => {
        // Stop retry on auth errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("JWT") || errorMessage.includes("auth") || errorMessage.includes("401")) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // Reduce DB load
    },
    mutations: {
      retry: 1,
    },
  },
});

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

// AppModeProvider wrapper that needs to be inside BrowserRouter
import { AppModeProvider } from "@/contexts/AppModeContext";
import { useMgTestRealtimeSync } from "@/hooks/useMgTestRealtimeSync";

const RealtimeListeners = () => {
  useMgTestRealtimeSync();
  return null;
};

const AppContent = () => (
  <AppModeProvider>
    <SessionTimeoutProvider>
      <RealtimeListeners />
      <AppRouter />
    </SessionTimeoutProvider>
  </AppModeProvider>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RolePreviewProvider>
          <React.Suspense fallback={null}>
            <TwilioDeviceProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
            </TwilioDeviceProvider>
          </React.Suspense>
        </RolePreviewProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
