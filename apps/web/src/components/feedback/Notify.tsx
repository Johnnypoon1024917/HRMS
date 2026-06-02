'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, Snackbar, Slide, type AlertColor } from '@mui/material';

/**
 * App-wide non-blocking feedback (Principle 4). Replaces inline <Alert> blocks
 * and the legacy "8000: save?" confirm dialogs with transient toasts.
 *
 * Usage:
 *   const notify = useNotify();
 *   notify.success('Record saved');
 *   notify.error(e.message);
 *
 * Toasts queue and show one at a time (MUI "consecutive snackbars" pattern).
 */

interface Toast {
  key: number;
  message: string;
  severity: AlertColor;
}

interface NotifyApi {
  notify: (message: string, severity?: AlertColor) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const Ctx = createContext<NotifyApi | null>(null);

export const useNotify = (): NotifyApi => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNotify must be used within <NotifyProvider>');
  return c;
};

export function NotifyProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Toast[]>([]);
  const [current, setCurrent] = useState<Toast | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const counter = useRef(0);

  // Pull the next toast off the queue when the slot frees up.
  const pump = useCallback(() => {
    setQueue((q) => {
      if (q.length === 0) return q;
      const [next, ...rest] = q;
      setCurrent(next);
      setOpen(true);
      return rest;
    });
  }, []);

  const push = useCallback(
    (message: string, severity: AlertColor) => {
      const toast: Toast = { key: (counter.current += 1), message, severity };
      setQueue((q) => [...q, toast]);
      // If nothing is showing, surface immediately on the next tick.
      setOpen((isOpen) => {
        if (!isOpen) setTimeout(pump, 0);
        return isOpen;
      });
    },
    [pump],
  );

  const api = useMemo<NotifyApi>(
    () => ({
      notify: (m, s = 'info') => push(m, s),
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
      warning: (m) => push(m, 'warning'),
    }),
    [push],
  );

  const handleClose = (_e?: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
  };

  // After the exit transition, drain the next queued toast.
  const handleExited = () => {
    setCurrent(undefined);
    pump();
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <Snackbar
        key={current?.key}
        open={open}
        autoHideDuration={4000}
        onClose={handleClose}
        TransitionComponent={Slide}
        TransitionProps={{ onExited: handleExited }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {current ? (
          <Alert
            onClose={handleClose}
            severity={current.severity}
            variant="filled"
            sx={{ width: '100%', boxShadow: 3 }}
          >
            {current.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Ctx.Provider>
  );
}
