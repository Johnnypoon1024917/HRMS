'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Autocomplete,
  CircularProgress,
  TextField,
  type AutocompleteProps,
} from '@mui/material';

/**
 * Typeahead entity picker (Principle 5). Use instead of a raw "Staff ID"
 * TextField or a rigid <Select> of every option.
 *
 * Two modes:
 *  - static:  pass `options` (filtered client-side) for small fixed lists.
 *  - async:   pass `fetchOptions(query)` for server-backed search (e.g. staff).
 */

export interface Option {
  value: string;
  label: string;
  /** Secondary line shown under the label (e.g. staff no., rank). */
  sublabel?: string;
}

type Props = {
  label: string;
  value: string | null;
  onChange: (value: string | null, option: Option | null) => void;
  options?: Option[];
  fetchOptions?: (query: string) => Promise<Option[]>;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  size?: 'small' | 'medium';
  sx?: AutocompleteProps<Option, false, false, false>['sx'];
  /** Debounce for async fetches, ms. */
  debounceMs?: number;
};

export function EntityAutocomplete({
  label,
  value,
  onChange,
  options,
  fetchOptions,
  required,
  disabled,
  error,
  helperText,
  size = 'small',
  sx,
  debounceMs = 250,
}: Props) {
  const [input, setInput] = useState('');
  const [loaded, setLoaded] = useState<Option[]>(options ?? []);
  const [loading, setLoading] = useState(false);
  // Remember resolved options so a preselected `value` can show its label.
  const cache = useRef<Map<string, Option>>(new Map());

  useEffect(() => {
    if (options) setLoaded(options);
  }, [options]);

  useEffect(() => {
    (options ?? loaded).forEach((o) => cache.current.set(o.value, o));
  }, [options, loaded]);

  // Async search with debounce.
  useEffect(() => {
    if (!fetchOptions) return;
    let active = true;
    setLoading(true);
    const handle = setTimeout(() => {
      fetchOptions(input)
        .then((res) => {
          if (!active) return;
          res.forEach((o) => cache.current.set(o.value, o));
          setLoaded(res);
        })
        .finally(() => active && setLoading(false));
    }, debounceMs);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [input, fetchOptions, debounceMs]);

  const selected = useMemo<Option | null>(() => {
    if (value == null) return null;
    return cache.current.get(value) ?? { value, label: value };
  }, [value, loaded]);

  return (
    <Autocomplete<Option, false, false, false>
      sx={sx}
      size={size}
      disabled={disabled}
      options={loaded}
      value={selected}
      loading={loading}
      isOptionEqualToValue={(o, v) => o.value === v.value}
      getOptionLabel={(o) => o.label}
      filterOptions={fetchOptions ? (x) => x : undefined}
      onInputChange={(_, v) => setInput(v)}
      onChange={(_, opt) => onChange(opt?.value ?? null, opt)}
      renderOption={(props, opt) => (
        <li {...props} key={opt.value}>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span>{opt.label}</span>
            {opt.sublabel && (
              <span style={{ fontSize: 12, opacity: 0.65 }}>{opt.sublabel}</span>
            )}
          </span>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          required={required}
          error={error}
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
