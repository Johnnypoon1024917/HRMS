'use client';

import { Box, Card, CardActionArea, CardContent, Grid, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { useBoot } from '@/theme/AppProviders';
import { Sym } from '@/components/Sym';
import { PageHeader } from '@/components/PageHeader';

const MODULE_NAMES: Record<string, string> = {
  pim: 'People',
  esm: 'Organisation',
  ess: 'Self-service',
  lve: 'Leave',
  pay: 'Payroll',
  pem: 'Performance',
  trm: 'Training',
  ham: 'Honours & awards',
  hbm: 'Housing benefits',
  cdm: 'Cases',
  exm: 'Exits',
  rec: 'Recruitment',
  pom: 'Postings',
  bil: 'Billing',
};

const MODULE_BLURBS: Record<string, string> = {
  pim: 'Staff records & profiles',
  esm: 'Org chart, posts, requests',
  ess: 'My profile & team',
  lve: 'Requests & approvals',
  pay: 'Pay runs & components',
  pem: 'Appraisals & cycles',
  trm: 'Courses & training records',
  ham: 'Awards & long-service',
  hbm: 'Enrolments & invoices',
  cdm: 'Conduct & disciplinary',
  exm: 'Exits & forecasting',
  rec: 'Jobs, pipeline, candidates',
  pom: 'Transfers & career moves',
  bil: 'Subscription & billing',
};

export default function Dashboard() {
  const { modules, branding } = useBoot();
  const router = useRouter();
  const theme = useTheme();

  return (
    <Box sx={{ maxWidth: 1200 }}>
      <PageHeader
        title="Welcome"
        subtitle={`${branding.appName} — choose a module to get started.`}
      />
      <Grid container spacing={2}>
        {modules.map((m) => {
          const target = m.nav[0]?.path;
          return (
            <Grid key={m.key} item xs={12} sm={6} md={4} lg={3}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.08)}`,
                  },
                }}
              >
                <CardActionArea
                  disabled={!target}
                  onClick={() => target && router.push(target)}
                  sx={{ height: '100%', alignItems: 'stretch' }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 1.5,
                      }}
                    >
                      <Sym name={branding.icons.overrides[m.key] ?? m.icon} size={22} />
                    </Box>
                    <Typography fontWeight={600} mb={0.25}>
                      {MODULE_NAMES[m.key] ?? m.nameKey.split('.').pop()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {MODULE_BLURBS[m.key] ?? ''}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
