'use client';

import { useState } from 'react';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import type { ImportResult } from '@hrms/contracts';
import { getToken } from '@/lib/api';
import { Sym } from '@/components/Sym';

/** Batch staff upload (UR-PIM-002). Commits only if ALL rows pass; otherwise
 *  an Excel exception report is produced. */
export default function StaffImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<ImportResult | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setErr('');
    setRes(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/pim/staff/import', {
        method: 'POST',
        headers: {
          'X-Tenant': process.env.NEXT_PUBLIC_TENANT ?? 'acme',
          Authorization: `Bearer ${getToken()}`,
        },
        body: fd,
      });
      if (!r.ok) throw new Error((await r.json()).message ?? r.statusText);
      setRes(await r.json());
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={2}>
        Import Staff (Excel)
      </Typography>
      <Paper variant="outlined" sx={{ p: 3, mb: 2 }}>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Columns: Staff No, Name (EN), Name (ZH), Sex, DOB, ID Type, ID No.
          Header row required. All-or-nothing commit.
        </Typography>
        <Button component="label" variant="outlined" startIcon={<Sym name="attach_file" size={18} />}>
          {file ? file.name : 'Choose .xlsx'}
          <input hidden type="file" accept=".xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Button>
        <Button sx={{ ml: 2 }} variant="contained" disabled={!file || busy}
          onClick={upload}>
          {busy ? 'Uploading…' : 'Upload'}
        </Button>
      </Paper>

      {err && <Alert severity="error">{err}</Alert>}
      {res && (
        <Alert severity={res.errorRows ? 'warning' : 'success'}>
          Batch {res.batchId}: {res.okRows}/{res.totalRows} imported,{' '}
          {res.errorRows} error(s).
          {res.exceptionFileKey &&
            ` Exception report: ${res.exceptionFileKey}`}
        </Alert>
      )}
    </Box>
  );
}
