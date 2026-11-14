import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './components/Toasts.jsx';
import Aurora from './components/Aurora.jsx';
import SiteHeader from './components/SiteHeader.jsx';
import Landing from './pages/Landing.jsx';
import Stub from './pages/Stub.jsx';
import NotFound from './pages/NotFound.jsx';

function ScrollAndFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
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
    </AnimatePresence>
  );
}

export default function App() {
  return (
    // reducedMotion="user": Framer Motion drops transform/layout animation for people who ask the OS for less motion.
    <MotionConfig reducedMotion="user">
      <ThemeProvider>
        <ToastProvider>
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          <Aurora />
          <SiteHeader />
          <ScrollAndFocus />
          <AnimatedRoutes />
          <footer className="site-footer">
            <div className="container">
              <span>© {new Date().getFullYear()} Outcome Ledger</span>
              <span>Measure value, not volume.</span>
            </div>
          </footer>
        </ToastProvider>
      </ThemeProvider>
    </MotionConfig>
  );
}
