import { Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { VibeProvider } from './context/VibeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { BurstProvider } from './components/Burst.jsx';
import { ToastProvider } from './components/Toasts.jsx';
import Ambient from './components/Ambient.jsx';
import CursorTrail from './components/CursorTrail.jsx';
import SiteHeader from './components/SiteHeader.jsx';
import TornTransition from './components/TornTransition.jsx';
import OneLiner from './components/OneLiner.jsx';
import AppShell from './components/AppShell.jsx';
import { PublicOnly, RequireRole } from './components/RouteGuards.jsx';
import Landing from './pages/Landing.jsx';
import NotFound from './pages/NotFound.jsx';
import ComingSoon from './pages/ComingSoon.jsx';
import Login from './pages/auth/Login.jsx';
import AdminSignup from './pages/auth/AdminSignup.jsx';
import EmployeeSignup from './pages/auth/EmployeeSignup.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import EmployeeDashboard from './pages/employee/EmployeeDashboard.jsx';
import { useHiddenFlag } from './lib/hooks.js';

const ADMIN_NAV = [
  { to: '/admin/overview', label: 'Overview' },
  { to: '/admin/team', label: 'Team' },
  { to: '/admin/review', label: 'Review Queue' },
  { to: '/admin/integrations', label: 'Integrations' },
];
const EMPLOYEE_NAV = [
  { to: '/app/dashboard', label: 'Dashboard' },
  { to: '/app/board', label: 'My Board' },
  { to: '/app/weekly-review', label: 'Weekly Review' },
];

function Shell() {
  useHiddenFlag(); // pauses every CSS animation while the tab is hidden
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Ambient />
      <CursorTrail />
      <SiteHeader />
      <TornTransition>
        {(location) => (
          <Routes location={location}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/admin/signup" element={<PublicOnly><AdminSignup /></PublicOnly>} />
            <Route path="/employee/signup" element={<PublicOnly><EmployeeSignup /></PublicOnly>} />

            <Route
              path="/admin"
              element={
                <RequireRole role="admin">
                  <AppShell nav={ADMIN_NAV} roleLabel="Admin" tone="calm" />
                </RequireRole>
              }
            >
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<AdminOverview />} />
              <Route path="team" element={<ComingSoon title="Team" milestone={6}>Scores per employee, plus a detail page for each person.</ComingSoon>} />
              <Route path="review" element={<ComingSoon title="Review Queue" milestone={5}>Escalated proofs wait here for your Approve / Needs rework.</ComingSoon>} />
              <Route path="integrations" element={<ComingSoon title="Integrations" milestone={4}>viaSocket flow URLs, test buttons and the activity log.</ComingSoon>} />
            </Route>

            <Route
              path="/app"
              element={
                <RequireRole role="employee">
                  <AppShell nav={EMPLOYEE_NAV} roleLabel="Employee" />
                </RequireRole>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<EmployeeDashboard />} />
              <Route path="board" element={<ComingSoon title="My Board" milestone={3}>Your kanban: Planned, In Progress, In Review, Done.</ComingSoon>} />
              <Route path="weekly-review" element={<ComingSoon title="Weekly Review" milestone={7}>What created value, what was busywork, and one thing to change.</ComingSoon>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </TornTransition>
      <footer className="site-footer">
        <div className="container">
          <span>© {new Date().getFullYear()} Outcome Ledger</span>
          <OneLiner kind="footer" interval={9000} />
        </div>
      </footer>
    </>
  );
}

export default function App() {
  return (
    // reducedMotion="user": Framer Motion drops transform/layout animation for people who ask the OS for less motion.
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <VibeProvider>
          <BurstProvider>
            <ToastProvider>
              <AuthProvider>
                <Shell />
              </AuthProvider>
            </ToastProvider>
          </BurstProvider>
        </VibeProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
