import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { migrateLocalDocuments } from "./services/documents";
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

function Loading() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "var(--sp8)" }}>
      <span className="spinner" />
    </div>
  );
}

/** Only redirects when this deployment actually expects a sign-in. In local mode
 *  a user always exists, so every route is reachable immediately. */
function Guarded({ children }: { children: React.ReactNode }) {
  const { loading, needsSignIn } = useAuth();
  if (loading) return <Loading />;
  if (needsSignIn) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { loading, needsSignIn } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          loading ? <Loading /> : needsSignIn ? <Landing /> : <Navigate to="/dashboard" replace />
        }
      />
      <Route path="/upload" element={<Guarded><Upload /></Guarded>} />
      <Route path="/processing/:documentId" element={<Guarded><Processing /></Guarded>} />
      <Route path="/dashboard" element={<Guarded><Dashboard /></Guarded>} />
      <Route path="/medications" element={<Guarded><Medication /></Guarded>} />
      <Route path="/appointments" element={<Guarded><Appointments /></Guarded>} />
      <Route path="/timeline" element={<Guarded><Timeline /></Guarded>} />
      <Route path="/emergency" element={<Guarded><Emergency /></Guarded>} />
      <Route path="/caregiver" element={<Guarded><CaregiverMode /></Guarded>} />
      <Route path="/ask" element={<Guarded><AskAI /></Guarded>} />
      <Route path="/terms" element={<Guarded><ExplainTerms /></Guarded>} />
      <Route path="/accessibility" element={<Guarded><Accessibility /></Guarded>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { user, mode, needsSignIn } = useAuth();

  // Documents added while the backend was asleep live only in this browser.
  // Send them on as soon as there is a backend and an account to attach them
  // to — including when the mode upgrades mid-session.
  useEffect(() => {
    if (mode !== "backend" || !user || user.isLocal) return;
    void migrateLocalDocuments(user);
  }, [mode, user]);

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

        {user && !needsSignIn && <BottomNav />}
      </div>
    </AccessibilityProvider>
  );
}
