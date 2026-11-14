import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertIcon, CheckIcon, InfoIcon, XIcon } from './Icons.jsx';

const ToastContext = createContext(() => {});
const ICONS = { success: CheckIcon, error: AlertIcon, warn: AlertIcon, info: InfoIcon };
const MAX_VISIBLE = 4;

function Toast({ toast, onDismiss }) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const Icon = ICONS[toast.type] || InfoIcon;

  useEffect(() => {
    if (paused || !toast.duration) return undefined;
    const id = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(id);
  }, [paused, toast.duration, toast.id, onDismiss]);

  return (
    <motion.div
      layout={!reduced}
      className={`toast toast-${toast.type}`}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, x: 60, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon className="t-ico" />
      <div>
        <strong>{toast.title}</strong>
        {toast.message && <span className="msg">{toast.message}</span>}
      </div>
      <button type="button" className="t-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
        <XIcon />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counter = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback((input) => {
    const opts = typeof input === 'string' ? { title: input } : input;
    const id = ++counter.current;
    const item = { id, type: 'info', duration: 4500, ...opts };
    setToasts((list) => [...list.slice(-(MAX_VISIBLE - 1)), item]);
    return id;
  }, []);

  const api = useMemo(() => {
    const fn = (input) => toast(input);
    fn.success = (title, message) => toast({ title, message, type: 'success' });
    fn.error = (title, message) => toast({ title, message, type: 'error', duration: 7000 });
    fn.warn = (title, message) => toast({ title, message, type: 'warn' });
    fn.info = (title, message) => toast({ title, message, type: 'info' });
    fn.dismiss = dismiss;
    return fn;
  }, [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
