'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';

/**
 * Promise-based confirm + prompt dialogs (Principle 4). Replaces the native,
 * unstyled window.confirm()/window.prompt() blocking modals.
 *
 *   const { confirm, prompt } = useDialogs();
 *   if (await confirm({ title: 'Close case?', destructive: true })) { ... }
 *   const reason = await prompt({ title: 'Rejection reason', label: 'Reason' });
 *   if (reason !== null) { ... }
 */

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm action in the error colour. */
  destructive?: boolean;
}

interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** HTML input type for the field (e.g. 'date', 'number'). */
  type?: string;
  required?: boolean;
  multiline?: boolean;
}

interface DialogsApi {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Resolves to the entered string, or null when cancelled. */
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const Ctx = createContext<DialogsApi | null>(null);

export const useDialogs = (): DialogsApi => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDialogs must be used within <ConfirmProvider>');
  return c;
};

type State =
  | { kind: 'confirm'; opts: ConfirmOptions }
  | { kind: 'prompt'; opts: PromptOptions }
  | null;

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(null);
  const [value, setValue] = useState('');
  const resolver = useRef<((v: any) => void) | null>(null);

  const settle = useCallback((result: boolean | string | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setState({ kind: 'confirm', opts });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    setValue(opts.defaultValue ?? '');
    setState({ kind: 'prompt', opts });
    return new Promise<string | null>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const api = useMemo<DialogsApi>(() => ({ confirm, prompt }), [confirm, prompt]);

  const isPrompt = state?.kind === 'prompt';
  const opts = state?.opts;
  const promptOpts = isPrompt ? (opts as PromptOptions) : undefined;
  const confirmOpts = state?.kind === 'confirm' ? (opts as ConfirmOptions) : undefined;
  const promptInvalid = !!promptOpts?.required && value.trim() === '';

  return (
    <Ctx.Provider value={api}>
      {children}
      <Dialog
        open={state !== null}
        onClose={() => settle(isPrompt ? null : false)}
        maxWidth="xs"
        fullWidth
      >
        {opts && <DialogTitle>{opts.title}</DialogTitle>}
        <DialogContent>
          {opts?.message && (
            <DialogContentText sx={{ mb: isPrompt ? 2 : 0 }}>
              {opts.message}
            </DialogContentText>
          )}
          {isPrompt && promptOpts && (
            <TextField
              autoFocus
              fullWidth
              label={promptOpts.label}
              type={promptOpts.type ?? 'text'}
              value={value}
              required={promptOpts.required}
              multiline={promptOpts.multiline}
              minRows={promptOpts.multiline ? 3 : undefined}
              InputLabelProps={
                promptOpts.type === 'date' ? { shrink: true } : undefined
              }
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !promptOpts.multiline && !promptInvalid) {
                  settle(value);
                }
              }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => settle(isPrompt ? null : false)}>
            {opts?.cancelLabel ?? 'Cancel'}
          </Button>
          {isPrompt ? (
            <Button
              variant="contained"
              disabled={promptInvalid}
              onClick={() => settle(value)}
            >
              {promptOpts?.confirmLabel ?? 'OK'}
            </Button>
          ) : (
            <Button
              variant="contained"
              color={confirmOpts?.destructive ? 'error' : 'primary'}
              onClick={() => settle(true)}
            >
              {confirmOpts?.confirmLabel ?? 'Confirm'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Ctx.Provider>
  );
}
