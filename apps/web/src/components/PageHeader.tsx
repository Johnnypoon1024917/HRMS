'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { Sym } from './Sym';

export interface PageAction {
  label: string;
  onClick: () => void;
  icon?: string;
  disabled?: boolean;
  /** Renders in the error colour (in the overflow menu). */
  destructive?: boolean;
}

/**
 * Standardised page header (Principle 3). Gives a single visual hierarchy:
 * one primary action button, with all secondary/tertiary actions collapsed
 * into an overflow (⋮) menu instead of a sprawling row of identical buttons.
 */
export function PageHeader({
  title,
  subtitle,
  primary,
  secondary = [],
}: {
  title: string;
  subtitle?: string;
  primary?: PageAction;
  secondary?: PageAction[];
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      spacing={2}
      mb={3}
    >
      <Box>
        <Typography variant="h5" fontWeight={600}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>

      <Stack direction="row" spacing={1} alignItems="center">
        {primary && (
          <Button
            variant="contained"
            onClick={primary.onClick}
            disabled={primary.disabled}
            startIcon={primary.icon ? <Sym name={primary.icon} size={18} /> : undefined}
          >
            {primary.label}
          </Button>
        )}
        {secondary.length > 0 && (
          <>
            <IconButton onClick={(e) => setAnchor(e.currentTarget)} aria-label="More actions">
              <Sym name="more_vert" size={22} />
            </IconButton>
            <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
              {secondary.map((a) => (
                <MenuItem
                  key={a.label}
                  disabled={a.disabled}
                  onClick={() => {
                    setAnchor(null);
                    a.onClick();
                  }}
                  sx={a.destructive ? { color: 'error.main' } : undefined}
                >
                  {a.icon && (
                    <ListItemIcon sx={a.destructive ? { color: 'error.main' } : undefined}>
                      <Sym name={a.icon} size={20} />
                    </ListItemIcon>
                  )}
                  <ListItemText>{a.label}</ListItemText>
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
      </Stack>
    </Stack>
  );
}
