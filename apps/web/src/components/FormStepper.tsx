'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Step,
  StepLabel,
  Stepper,
  Stack,
} from '@mui/material';
import { Sym } from './Sym';

export interface WizardStep {
  label: string;
  content: React.ReactNode;
  /** Return false to block advancing past this step. */
  isValid?: boolean;
  optional?: boolean;
}

/**
 * Multi-step wizard (Principle 5 — progressive disclosure). Use for long
 * flows (onboarding, creating a disciplinary case) instead of dumping every
 * field on one screen.
 */
export function FormStepper({
  steps,
  onFinish,
  finishLabel = 'Finish',
  submitting = false,
}: {
  steps: WizardStep[];
  onFinish: () => void;
  finishLabel?: string;
  submitting?: boolean;
}) {
  const [active, setActive] = useState(0);
  const isLast = active === steps.length - 1;
  const step = steps[active];
  const blocked = step?.isValid === false;

  return (
    <Box>
      <Stepper activeStep={active} sx={{ mb: 4 }}>
        {steps.map((s) => (
          <Step key={s.label} completed={undefined}>
            <StepLabel optional={s.optional ? 'Optional' : undefined}>
              {s.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ mb: 4 }}>{step?.content}</Box>

      <Stack direction="row" spacing={1.5} justifyContent="space-between">
        <Button
          disabled={active === 0 || submitting}
          onClick={() => setActive((a) => a - 1)}
          startIcon={<Sym name="arrow_back" size={18} />}
        >
          Back
        </Button>
        {isLast ? (
          <Button
            variant="contained"
            onClick={onFinish}
            disabled={blocked || submitting}
            startIcon={!submitting && <Sym name="check" size={18} />}
          >
            {submitting ? 'Submitting…' : finishLabel}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => setActive((a) => a + 1)}
            disabled={blocked}
            endIcon={<Sym name="arrow_forward" size={18} />}
          >
            Next
          </Button>
        )}
      </Stack>
    </Box>
  );
}
