'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, MenuItem, TextField } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { CandidateUpsert, CandidateView } from '@hrms/contracts';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { CrudDrawer } from '@/components/CrudDrawer';
import { EntityAutocomplete } from '@/components/inputs/EntityAutocomplete';
import { useNotify } from '@/components/feedback/Notify';

const cols: GridColDef[] = [
  { field: 'firstName', headerName: 'First', width: 140 },
  { field: 'lastName', headerName: 'Last', width: 140 },
  { field: 'email', headerName: 'Email', flex: 1 },
  { field: 'phone', headerName: 'Phone', width: 150 },
  { field: 'source', headerName: 'Source', width: 130 },
];

const emptyCandidate: CandidateUpsert = {
  firstName: '', lastName: '', email: '', phone: '', source: '',
};

export default function CandidatesPage() {
  const notify = useNotify();
  const [rows, setRows] = useState<CandidateView[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<CandidateUpsert>(emptyCandidate);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [apply, setApply] = useState({ candidateId: '', jobCode: '' });

  const load = async () => {
    setLoading(true);
    try {
      setRows(await api<CandidateView[]>('/rec/candidates'));
      setJobs(await api<any[]>('/rec/jobs?status=open'));
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const candidateOptions = useMemo(
    () => rows.map((c) => ({
      value: c.id,
      label: `${c.firstName} ${c.lastName}`,
      sublabel: c.email,
    })),
    [rows],
  );

  const openCandidate = () => { setF(emptyCandidate); setOpen(true); };
  const openApply = () => { setApply({ candidateId: '', jobCode: '' }); setApplyOpen(true); };

  const save = async () => {
    setSaving(true);
    try {
      const c = await api<CandidateView>('/rec/candidates', {
        method: 'PUT', body: JSON.stringify(f),
      });
      notify.success(`Saved candidate ${c.email}.`);
      setOpen(false);
      load();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const submitApply = async () => {
    setApplying(true);
    try {
      await api('/rec/applications', {
        method: 'POST', body: JSON.stringify(apply),
      });
      notify.success(`Applied ${apply.candidateId} to ${apply.jobCode}.`);
      setApplyOpen(false);
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Candidates"
        primary={{ label: 'Add candidate', icon: 'add', onClick: openCandidate }}
        secondary={[{ label: 'Apply to a job', onClick: openApply }]}
      />

      <div style={{ height: 460, width: '100%' }}>
        <DataGrid rows={rows} loading={loading} columns={cols} disableRowSelectionOnClick />
      </div>

      <CrudDrawer
        open={open}
        title="Add / update candidate"
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitLabel="Save"
        submitting={saving}
        submitDisabled={!f.firstName || !f.lastName || !f.email}
      >
        <TextField label="First name" value={f.firstName}
          onChange={(e) => setF({ ...f, firstName: e.target.value })} required />
        <TextField label="Last name" value={f.lastName}
          onChange={(e) => setF({ ...f, lastName: e.target.value })} required />
        <TextField label="Email" value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <TextField label="Phone" value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <TextField label="Source" value={f.source}
          onChange={(e) => setF({ ...f, source: e.target.value })} />
      </CrudDrawer>

      <CrudDrawer
        open={applyOpen}
        title="Apply candidate to a job"
        onClose={() => setApplyOpen(false)}
        onSubmit={submitApply}
        submitLabel="Apply"
        submitting={applying}
        submitDisabled={!apply.candidateId || !apply.jobCode}
      >
        <EntityAutocomplete
          label="Candidate"
          value={apply.candidateId || null}
          onChange={(id) => setApply({ ...apply, candidateId: id ?? '' })}
          options={candidateOptions}
          required
        />
        <TextField select label="Job" value={apply.jobCode} required
          onChange={(e) => setApply({ ...apply, jobCode: e.target.value })}>
          {jobs.map((j) => (
            <MenuItem key={j.code} value={j.code}>{j.code} — {j.title}</MenuItem>
          ))}
        </TextField>
      </CrudDrawer>
    </Box>
  );
}
