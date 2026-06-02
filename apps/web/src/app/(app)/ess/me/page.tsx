'use client';

import { useEffect, useState } from 'react';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useRouter } from 'next/navigation';
import type { MyProfile } from '@hrms/contracts';
import { api } from '@/lib/api';
import { Sym } from '@/components/Sym';
import { PageHeader } from '@/components/PageHeader';
import { useNotify } from '@/components/feedback/Notify';

const apptCols: GridColDef[] = [
  { field: 'rankCode', headerName: 'Rank', width: 100 },
  { field: 'postTitle', headerName: 'Post', flex: 1 },
  { field: 'orgUnitName', headerName: 'Unit', flex: 1 },
  { field: 'basis', headerName: 'Basis', width: 110 },
  { field: 'effectiveFrom', headerName: 'From', width: 120 },
  { field: 'effectiveTo', headerName: 'To', width: 120 },
];

export default function MyProfilePage() {
  const notify = useNotify();
  const [p, setP] = useState<MyProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    api<MyProfile>('/ess/me')
      .then(setP)
      .catch((e: any) => notify.error(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null;

  return (
    <Box>
      <PageHeader title="My Profile" />

      <Grid container spacing={2} mb={3}>
        <Grid item xs={12} md={5}>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                <Avatar sx={{ width: 56, height: 56 }}>
                  {p.nameEn.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    {p.nameEn} {p.nameZh && `（${p.nameZh}）`}
                  </Typography>
                  <Typography color="text.secondary">
                    {p.staffNo} · {p.currentRank ?? '—'} · {p.currentUnit ?? '—'}
                  </Typography>
                </Box>
              </Stack>
              <Typography variant="body2">Sex: {p.sex}</Typography>
              <Typography variant="body2">DOB: {p.dob}</Typography>
              <Typography variant="body2">
                {p.idType}: {p.idNoMasked}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Card variant="outlined">
            <CardContent>
              <Typography fontWeight={600} mb={1}>
                Leave balances
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {p.leaveSummary.length === 0 && (
                  <Typography color="text.secondary" variant="body2">
                    No leave data.
                  </Typography>
                )}
                {p.leaveSummary.map((l) => (
                  <Chip
                    key={l.leaveTypeCode}
                    label={`${l.leaveTypeCode}: ${l.remaining}`}
                    onClick={() => router.push('/lve/me')}
                  />
                ))}
              </Stack>
              <Stack direction="row" spacing={1} mt={3}>
                <Chip icon={<Sym name="event_available" size={16} />}
                  label="Request leave" onClick={() => router.push('/lve/me')} />
                <Chip icon={<Sym name="payments" size={16} />}
                  label="My payslips" onClick={() => router.push('/pay/runs')} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography fontWeight={600} mb={1}>
        Appointment history
      </Typography>
      <div style={{ height: 360, width: '100%' }}>
        <DataGrid
          rows={p.appointments.map((a, i) => ({ id: i, ...a }))}
          columns={apptCols}
          disableRowSelectionOnClick
        />
      </div>
    </Box>
  );
}
