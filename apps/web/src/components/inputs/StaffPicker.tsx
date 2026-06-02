'use client';

import type { Paged, StaffListItem } from '@hrms/contracts';
import { api } from '@/lib/api';
import { EntityAutocomplete, type Option } from './EntityAutocomplete';

/**
 * Staff typeahead backed by the multi-criteria search endpoint
 * (GET /pim/staff?name=). The selected value is the staff `id`.
 */
export function StaffPicker({
  label = 'Staff',
  value,
  onChange,
  required,
  disabled,
  sx,
}: {
  label?: string;
  value: string | null;
  onChange: (id: string | null, staff: StaffListItem | null) => void;
  required?: boolean;
  disabled?: boolean;
  sx?: object;
}) {
  const fetchOptions = async (q: string): Promise<Option[]> => {
    const qs = new URLSearchParams({ pageSize: '20', ...(q ? { name: q } : {}) });
    const res = await api<Paged<StaffListItem>>(`/pim/staff?${qs}`);
    return res.items.map((s) => ({
      value: s.id,
      label: s.nameZh ? `${s.nameEn} / ${s.nameZh}` : s.nameEn,
      sublabel: [s.staffNo, s.rankCode, s.orgUnitName].filter(Boolean).join(' · '),
    }));
  };

  return (
    <EntityAutocomplete
      label={label}
      value={value}
      onChange={(id, opt) =>
        onChange(id, opt ? ({ id: opt.value, staffNo: '', nameEn: opt.label, status: 'active' } as StaffListItem) : null)
      }
      fetchOptions={fetchOptions}
      required={required}
      disabled={disabled}
      sx={sx}
    />
  );
}
