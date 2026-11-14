import { Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { VibeProvider } from './context/VibeContext.jsx';
import { BurstProvider } from './components/Burst.jsx';
import { ToastProvider } from './components/Toasts.jsx';
import Ambient from './components/Ambient.jsx';
import CursorTrail from './components/CursorTrail.jsx';
import SiteHeader from './components/SiteHeader.jsx';
import TornTransition from './components/TornTransition.jsx';
import OneLiner from './components/OneLiner.jsx';
import Landing from './pages/Landing.jsx';
import Stub from './pages/Stub.jsx';
import NotFound from './pages/NotFound.jsx';
import { useHiddenFlag } from './lib/hooks.js';

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
            <Route path="/login" element={<Stub title="Log in" blurb="Admins and employees sign in here and land on their own pages." />} />
            <Route
              path="/admin/signup"
              element={<Stub title="Create your workspace" blurb="Admins create a company workspace and receive an invite code for their team." />}
            />
            <Route
              path="/employee/signup"
              element={<Stub title="Join with an invite code" blurb="Employees join an existing workspace with the code their admin shares." />}
            />
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
              <Shell />
            </ToastProvider>
          </BurstProvider>
        </VibeProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
