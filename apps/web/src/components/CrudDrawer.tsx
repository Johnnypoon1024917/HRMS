'use client';

import {
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { Sym } from './Sym';

/**
 * Right-anchored drawer for create/edit forms (Principle 3). Replaces inline
 * "form above the grid" editing and disconnected global Save buttons: the
 * fields live in the body, Save/Cancel sit in a sticky footer next to them.
 */
export function CrudDrawer({
  open,
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  submitting = false,
  submitDisabled = false,
  width = 460,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: width } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ p: 2 }}
        >
          <Box>
            <Typography variant="h6">{title}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} aria-label="Close">
            <Sym name="close" size={22} />
          </IconButton>
        </Stack>
        <Divider />

        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!submitting && !submitDisabled) onSubmit();
          }}
          sx={{ flex: 1, overflowY: 'auto', p: 2 }}
        >
          <Stack spacing={2.5}>{children}</Stack>
        </Box>

        <Divider />
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ p: 2 }}>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={onSubmit}
            disabled={submitting || submitDisabled}
            startIcon={!submitting && <Sym name="check" size={18} />}
          >
            {submitting ? 'Saving…' : submitLabel}
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
