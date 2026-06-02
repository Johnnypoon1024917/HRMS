'use client';

import { useEffect, useState } from 'react';
import { Box, MenuItem, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { AwardView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { StaffPicker } from '@/components/inputs/StaffPicker';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff', width: 110 },
  { field: 'staffName', headerName: 'Name', flex: 1 },
  { field: 'awardTypeCode', headerName: 'Code', width: 110 },
  { field: 'awardTypeName', headerName: 'Award', flex: 1 },
  { field: 'kind', headerName: 'Kind', width: 120 },
  { field: 'awardedOn', headerName: 'Date', width: 130 },
  { field: 'citation', headerName: 'Citation', flex: 1 },
];

const emptyForm = {
  staffId: '',
  awardTypeCode: '',
  awardedOn: new Date().toISOString().slice(0, 10),
  citation: '',
};

export default function AwardsPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<AwardView[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<AwardView[]>('/ham/awards'));
      setTypes(await api<any[]>('/ham/types'));
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => { setF(emptyForm); setOpen(true); };

  const grant = async () => {
    setSaving(true);
    try {
      await api('/ham/awards', { method: 'POST', body: JSON.stringify(f) });
      notify.success('Award granted.');
      setOpen(false);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Awards"
        primary={{ label: 'Grant award', icon: 'add', onClick: openDrawer }}
      />

      <div style={{ height: 500, width: '100%' }}>
        <DataGrid rows={rows} loading={loading} columns={cols} disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="Grant award"
        onClose={() => setOpen(false)}
        onSubmit={grant}
        submitLabel="Grant"
        submitting={saving}
        submitDisabled={!f.staffId || !f.awardTypeCode}
      >
        <StaffPicker
          value={f.staffId || null}
          onChange={(id) => setF({ ...f, staffId: id ?? '' })}
          required
        />
        <TextField select label="Award" value={f.awardTypeCode} required
          onChange={(e) => setF({ ...f, awardTypeCode: e.target.value })}>
          {types.map((t) => (
            <MenuItem key={t.code} value={t.code}>{t.nameEn}</MenuItem>
          ))}
        </TextField>
        <TextField type="date" label="Date" InputLabelProps={{ shrink: true }}
          value={f.awardedOn}
          onChange={(e) => setF({ ...f, awardedOn: e.target.value })} />
        <TextField label="Citation" value={f.citation}
          onChange={(e) => setF({ ...f, citation: e.target.value })} />
      </CrudDrawer>
    </Box>
  );
}
