import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { AccessibilityProvider } from "./hooks/useAccessibility";
import { ReadAloudButton } from "./components/ReadAloudButton";
import { BottomNav } from "./components/BottomNav/BottomNav";

import Landing from "./screens/Landing/Landing";
import Upload from "./screens/Upload/Upload";
import Processing from "./screens/Processing/Processing";
import Dashboard from "./screens/Dashboard/Dashboard";
import Medication from "./screens/Medication/Medication";
import Appointments from "./screens/Appointments/Appointments";
import Timeline from "./screens/Timeline/Timeline";
import Emergency from "./screens/Emergency/Emergency";
import CaregiverMode from "./screens/CaregiverMode/CaregiverMode";
import AskAI from "./screens/AskAI/AskAI";
import ExplainTerms from "./screens/ExplainTerms/ExplainTerms";
import Accessibility from "./screens/Accessibility/Accessibility";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "var(--sp8)" }}>
        <span className="spinner" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/" element={loading ? null : user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
      <Route path="/processing/:documentId" element={<ProtectedRoute><Processing /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/medications" element={<ProtectedRoute><Medication /></ProtectedRoute>} />
      <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
      <Route path="/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
      <Route path="/emergency" element={<ProtectedRoute><Emergency /></ProtectedRoute>} />
      <Route path="/caregiver" element={<ProtectedRoute><CaregiverMode /></ProtectedRoute>} />
      <Route path="/ask" element={<ProtectedRoute><AskAI /></ProtectedRoute>} />
      <Route path="/terms" element={<ProtectedRoute><ExplainTerms /></ProtectedRoute>} />
      <Route path="/accessibility" element={<ProtectedRoute><Accessibility /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <AccessibilityProvider>
      <div className="app-shell">
        <a href="#main-content" className="sr-only">Skip to main content</a>
        <header className="topbar">
          <span className="logo">
            <i className="ph-duotone ph-heartbeat" aria-hidden="true" />
            AfterCare
          </span>
          <span className="spacer" />
          <ReadAloudButton />
        </header>

        <main className="content" id="main-content">
          <AppRoutes />
        </main>

        {user && <BottomNav />}
      </div>
    </AccessibilityProvider>
  );
}
