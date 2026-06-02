'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { StaffDetail } from '@hrms/contracts';
import { api } from '@/lib/api';
import { Sym } from '@/components/Sym';
import { CrudDrawer } from '@/components/CrudDrawer';
import { useNotify } from '@/components/feedback/Notify';

/**
 * Entity-centric Employee Profile (Principle 1). One page per person with
 * tabs — Personal, Contact, Career, Compensation, Qualifications — replacing
 * the legacy fragmented "Update Name / Upload Photo / Update Address" screens.
 */
export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const notify = useNotify();
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);

  const load = () => {
    setLoading(true);
    api<StaffDetail>(`/pim/staff/${id}`)
      .then(setStaff)
      .catch((e) => notify.error(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!staff) {
    return <Typography>Staff not found.</Typography>;
  }

  const initials = staff.nameEn.split(' ').map((p) => p[0]).slice(0, 2).join('');
  const current = staff.appointments?.[0];

  return (
    <Box>
      <Button
        onClick={() => router.push('/pim/staff')}
        startIcon={<Sym name="arrow_back" size={18} />}
        sx={{ mb: 2 }}
      >
        Staff directory
      </Button>

      {/* Identity header */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        mb={3}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ width: 64, height: 64, fontSize: 24 }}>{initials}</Avatar>
          <Box>
            <Typography variant="h5" fontWeight={600}>
              {staff.nameEn}
              {staff.nameZh ? `  ${staff.nameZh}` : ''}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
              <Typography variant="body2" color="text.secondary">
                {staff.staffNo}
              </Typography>
              {current?.rankCode && (
                <Chip size="small" label={current.rankCode} />
              )}
              <Chip
                size="small"
                color={staff.status === 'active' ? 'success' : 'default'}
                label={staff.status ?? 'active'}
              />
              {staff.restricted && <Chip size="small" color="warning" label="Restricted" />}
            </Stack>
          </Box>
        </Stack>
        {!staff.restricted && (
          <Button
            variant="contained"
            startIcon={<Sym name="edit" size={18} />}
            onClick={() => setEditOpen(true)}
          >
            Edit particulars
          </Button>
        )}
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab label="Personal" />
        <Tab label="Contact" />
        <Tab label="Career" />
        <Tab label="Compensation" />
        <Tab label="Qualifications" />
      </Tabs>

      {tab === 0 && <PersonalTab staff={staff} />}
      {tab === 1 && <ContactTab staff={staff} />}
      {tab === 2 && <CareerTab staff={staff} />}
      {tab === 3 && <CompensationTab staff={staff} />}
      {tab === 4 && <QualificationsTab staff={staff} />}

      {!staff.restricted && (
        <EditParticularsDrawer
          open={editOpen}
          staff={staff}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            notify.success('Particulars saved');
            load();
          }}
        />
      )}
    </Box>
  );
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1">{value ?? '—'}</Typography>
    </Grid>
  );
}

function PersonalTab({ staff }: { staff: StaffDetail }) {
  return (
    <Card>
      <CardContent>
        <Grid container spacing={3}>
          <Field label="Name (English)" value={staff.nameEn} />
          <Field label="Name (Chinese)" value={staff.nameZh} />
          <Field label="Staff No." value={staff.staffNo} />
          <Field label="Sex" value={staff.sex} />
          <Field label="Date of birth" value={fmtDate(staff.dob)} />
          <Field label="ID type" value={staff.idType} />
          <Field label="ID number" value={staff.idNoMasked} />
          <Field label="Classification" value={staff.classification} />
          <Field label="Status" value={staff.status} />
        </Grid>
      </CardContent>
    </Card>
  );
}

function ContactTab({ staff }: { staff: StaffDetail }) {
  const contacts = staff.contacts ?? [];
  if (!contacts.length) return <Empty label="No contact records." />;
  return (
    <Card>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Kind</TableCell>
            <TableCell>Value</TableCell>
            <TableCell>From</TableCell>
            <TableCell>To</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {contacts.map((c) => (
            <TableRow key={c.id}>
              <TableCell><Chip size="small" label={c.kind} /></TableCell>
              <TableCell>{c.value}</TableCell>
              <TableCell>{fmtDate(c.effectiveFrom)}</TableCell>
              <TableCell>{c.effectiveTo ? fmtDate(c.effectiveTo) : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function CareerTab({ staff }: { staff: StaffDetail }) {
  const appts = staff.appointments ?? [];
  if (!appts.length) return <Empty label="No appointment history." />;
  return (
    <Card>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Rank</TableCell>
            <TableCell>Basis</TableCell>
            <TableCell>Contract type</TableCell>
            <TableCell>From</TableCell>
            <TableCell>To</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {appts.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{a.rankCode}</TableCell>
              <TableCell>{a.basis}</TableCell>
              <TableCell>{a.contractType}</TableCell>
              <TableCell>{fmtDate(a.effectiveFrom)}</TableCell>
              <TableCell>{a.effectiveTo ? fmtDate(a.effectiveTo) : 'Current'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function CompensationTab({ staff }: { staff: StaffDetail }) {
  const sal = staff.salaries ?? [];
  if (!sal.length) return <Empty label="No salary records." />;
  return (
    <Card>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Scale</TableCell>
            <TableCell>Point</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>From</TableCell>
            <TableCell>To</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sal.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.scaleCode}</TableCell>
              <TableCell>{s.point}</TableCell>
              <TableCell align="right">{s.amount}</TableCell>
              <TableCell>{fmtDate(s.effectiveFrom)}</TableCell>
              <TableCell>{s.effectiveTo ? fmtDate(s.effectiveTo) : 'Current'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function QualificationsTab({ staff }: { staff: StaffDetail }) {
  const quals = staff.qualifications ?? [];
  if (!quals.length) return <Empty label="No qualifications recorded." />;
  return (
    <Card>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Type</TableCell>
            <TableCell>Title</TableCell>
            <TableCell>Institution</TableCell>
            <TableCell>Awarded</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {quals.map((q) => (
            <TableRow key={q.id}>
              <TableCell>{q.type}</TableCell>
              <TableCell>{q.title}</TableCell>
              <TableCell>{q.institution ?? '—'}</TableCell>
              <TableCell>{q.awardedOn ? fmtDate(q.awardedOn) : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <Card>
      <CardContent>
        <Typography color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return d.slice(0, 10);
}

/** Edit core particulars via the standard CRUD drawer (PUT /pim/staff). */
function EditParticularsDrawer({
  open,
  staff,
  onClose,
  onSaved,
}: {
  open: boolean;
  staff: StaffDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const notify = useNotify();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    staffNo: staff.staffNo,
    nameEn: staff.nameEn,
    nameZh: staff.nameZh ?? '',
    sex: staff.sex ?? 'M',
    dob: (staff.dob ?? '').slice(0, 10),
    idType: staff.idType ?? '',
    idNo: '',
    classification: staff.classification ?? 'internal',
    status: staff.status ?? 'active',
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      await api('/pim/staff', { method: 'PUT', body: JSON.stringify(form) });
      onSaved();
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CrudDrawer
      open={open}
      title="Edit particulars"
      subtitle={staff.staffNo}
      onClose={onClose}
      onSubmit={submit}
      submitting={saving}
      submitDisabled={!form.nameEn || !form.idNo}
    >
      <TextField label="Name (English)" value={form.nameEn} required
        onChange={(e) => set('nameEn', e.target.value)} />
      <TextField label="Name (Chinese)" value={form.nameZh}
        onChange={(e) => set('nameZh', e.target.value)} />
      <TextField select label="Sex" value={form.sex}
        onChange={(e) => set('sex', e.target.value)}>
        <MenuItem value="M">Male</MenuItem>
        <MenuItem value="F">Female</MenuItem>
        <MenuItem value="X">Other</MenuItem>
      </TextField>
      <TextField type="date" label="Date of birth" value={form.dob}
        InputLabelProps={{ shrink: true }}
        onChange={(e) => set('dob', e.target.value)} />
      <Divider textAlign="left">
        <Typography variant="caption" color="text.secondary">Identity</Typography>
      </Divider>
      <TextField label="ID type" value={form.idType}
        onChange={(e) => set('idType', e.target.value)} />
      <TextField label="ID number" value={form.idNo} required
        helperText="Re-enter to confirm; stored encrypted at rest."
        onChange={(e) => set('idNo', e.target.value)} />
      <TextField select label="Classification" value={form.classification}
        onChange={(e) => set('classification', e.target.value)}>
        <MenuItem value="public">Public</MenuItem>
        <MenuItem value="internal">Internal</MenuItem>
        <MenuItem value="restricted">Restricted</MenuItem>
      </TextField>
      <TextField select label="Status" value={form.status}
        onChange={(e) => set('status', e.target.value)}>
        <MenuItem value="active">Active</MenuItem>
        <MenuItem value="delflag">Inactive</MenuItem>
      </TextField>
    </CrudDrawer>
  );
}
