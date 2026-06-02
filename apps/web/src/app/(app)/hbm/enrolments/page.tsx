'use client';

import { useEffect, useState } from 'react';
import { Box, Button, Chip, MenuItem, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { BenefitView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { StaffPicker } from '@/components/inputs/StaffPicker';
import { useNotify } from '@/components/feedback/Notify';
import { useDialogs } from '@/components/feedback/Confirm';

const cols: GridColDef[] = [
  { field: 'staffNo', headerName: 'Staff', width: 110 },
  { field: 'staffName', headerName: 'Name', flex: 1 },
  { field: 'benefitTypeName', headerName: 'Benefit', flex: 1 },
  { field: 'category', headerName: 'Category', width: 130 },
  {
    field: 'chargeable', headerName: 'Charged', width: 100,
    renderCell: (p) => p.value ? <Chip size="small" color="warning" label="bill" /> : '—',
  },
  { field: 'monthlyAmount', headerName: 'Monthly', width: 110 },
  { field: 'effectiveFrom', headerName: 'From', width: 120 },
  { field: 'effectiveTo', headerName: 'To', width: 120 },
];

const emptyForm = {
  staffId: '',
  benefitTypeCode: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  monthlyAmount: 0,
};

export default function BenefitEnrolmentsPage() {
  const notify = useNotify();
  const { prompt } = useDialogs();
  const [rows, setRows] = useState<BenefitView[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<BenefitView[]>('/hbm/enrolments'));
      setTypes(await api<any[]>('/hbm/types'));
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openDrawer = () => { setF(emptyForm); setOpen(true); };

  const enrol = async () => {
    setSaving(true);
    try {
      await api('/hbm/enrolments', {
        method: 'POST',
        body: JSON.stringify({ ...f, monthlyAmount: f.monthlyAmount || undefined }),
      });
      notify.success('Enrolled');
      setOpen(false);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const terminate = async (id: string) => {
    const date = await prompt({
      title: 'End enrolment',
      label: 'End date',
      type: 'date',
      defaultValue: new Date().toISOString().slice(0, 10),
      required: true,
      confirmLabel: 'End',
    });
    if (!date) return;
    try {
      await api(`/hbm/enrolments/${id}/terminate`, {
        method: 'POST', body: JSON.stringify({ effectiveTo: date }),
      });
      notify.success('Enrolment ended');
      load();
    } catch (e: any) {
      notify.error(e.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Benefit Enrolments"
        primary={{ label: 'Enrol staff', icon: 'add', onClick: openDrawer }}
      />

      <div style={{ height: 480, width: '100%' }}>
        <DataGrid
          rows={rows}
          loading={loading}
          columns={[
            ...cols,
            {
              field: 'actions', headerName: '', width: 110, sortable: false,
              renderCell: (p) =>
                p.row.effectiveTo ? null : (
                  <Button size="small" color="error" onClick={() => terminate(p.row.id)}>
                    End
                  </Button>
                ),
            },
          ]}
          disableRowSelectionOnClick
        />
      </div>

      <CrudDrawer
        open={open}
        title="Enrol staff in benefit"
        onClose={() => setOpen(false)}
        onSubmit={enrol}
        submitLabel="Enrol"
        submitting={saving}
        submitDisabled={!f.staffId || !f.benefitTypeCode}
      >
        <StaffPicker
          value={f.staffId || null}
          onChange={(id) => setF({ ...f, staffId: id ?? '' })}
          required
        />
        <TextField select label="Benefit" value={f.benefitTypeCode} required
          onChange={(e) => setF({ ...f, benefitTypeCode: e.target.value })}>
          {types.map((t) => (
            <MenuItem key={t.code} value={t.code}>{t.nameEn}</MenuItem>
          ))}
        </TextField>
        <TextField type="date" label="Effective from" InputLabelProps={{ shrink: true }}
          value={f.effectiveFrom}
          onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} />
        <TextField type="number" label="Monthly amount (override)"
          value={f.monthlyAmount}
          onChange={(e) => setF({ ...f, monthlyAmount: Number(e.target.value) })} />
      </CrudDrawer>
    </Box>
  );
}
