import { Injectable, Logger } from '@nestjs/common';
import type { HolidaySync, HolidayUpsert, PublicHolidayView } from '@hrms/contracts';
import { TenantPrismaService } from '../../../common/prisma/tenant-prisma.service';

/**
 * Sync HK public holidays from data.gov.hk. The 1823 calendar publishes the
 * general gazetted holiday list in iCalendar (.ics) at:
 *   https://www.1823.gov.hk/common/ical/en.ics
 *   https://www.1823.gov.hk/common/ical/tc.ics  (Traditional Chinese)
 *
 * Statutory holidays (the legally-mandated subset of 12) are a fixed
 * sub-list we maintain in-tree because data.gov.hk doesn't classify them
 * separately. Override per-tenant via PublicHoliday rows of type=company.
 */
@Injectable()
export class HolidayService {
  private readonly log = new Logger(HolidayService.name);

  constructor(private readonly tp: TenantPrismaService) {}

  /** Fetch + upsert holidays. Falls back to a built-in list if the source
   *  is unreachable (offline dev environments). */
  async sync(input: HolidaySync) {
    const db = this.tp.forCurrentTenant();
    const sourceUrl =
      input.sourceUrl ??
      (input.localeCode === 'HK'
        ? 'https://www.1823.gov.hk/common/ical/en.ics'
        : 'https://www.1823.gov.hk/common/ical/en.ics');

    let items: IcsItem[] = [];
    let status: 'ok' | 'failed' = 'ok';
    let errorMessage: string | null = null;

    try {
      const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ics = await res.text();
      items = parseIcs(ics);
      this.log.log(`Fetched ${items.length} holidays from ${sourceUrl}`);
    } catch (e) {
      status = 'failed';
      errorMessage = (e as Error).message;
      this.log.warn(`Holiday sync from ${sourceUrl} failed (${errorMessage}); using built-in fallback`);
      items = FALLBACK_HK_HOLIDAYS;
    }

    const statutorySet = new Set(STATUTORY_HK_NAMES);
    let upserts = 0;
    for (const it of items) {
      const type = statutorySet.has(normalize(it.nameEn)) ? 'statutory' : 'general';
      await db.publicHoliday.upsert({
        where: {
          date_localeCode_nameEn: {
            date: new Date(it.date),
            localeCode: input.localeCode,
            nameEn: it.nameEn,
          },
        },
        create: {
          date: new Date(it.date),
          localeCode: input.localeCode,
          nameEn: it.nameEn,
          nameZh: it.nameZh,
          type,
          source: status === 'ok' ? sourceUrl : 'fallback',
        },
        update: { nameZh: it.nameZh, type, source: status === 'ok' ? sourceUrl : 'fallback' },
      });
      upserts++;
    }

    await db.holidayCalendarSync.upsert({
      where: { localeCode: input.localeCode },
      create: {
        localeCode: input.localeCode,
        sourceUrl,
        lastSyncAt: new Date(),
        itemCount: upserts,
        status,
        errorMessage,
      },
      update: {
        sourceUrl,
        lastSyncAt: new Date(),
        itemCount: upserts,
        status,
        errorMessage,
      },
    });

    return { upserts, status, errorMessage, sourceUrl };
  }

  async list(localeCode: string, from?: string, to?: string): Promise<PublicHolidayView[]> {
    const where: any = { localeCode };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }
    const rows = await this.tp.forCurrentTenant().publicHoliday.findMany({
      where, orderBy: { date: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      localeCode: r.localeCode,
      nameEn: r.nameEn,
      nameZh: r.nameZh ?? undefined,
      type: r.type as any,
      source: r.source,
    }));
  }

  async upsert(input: HolidayUpsert) {
    return this.tp.forCurrentTenant().publicHoliday.upsert({
      where: {
        date_localeCode_nameEn: {
          date: new Date(input.date),
          localeCode: input.localeCode,
          nameEn: input.nameEn,
        },
      },
      create: { ...input, date: new Date(input.date) },
      update: { ...input, date: new Date(input.date) },
    });
  }

  async lastSync(localeCode: string) {
    return this.tp
      .forCurrentTenant()
      .holidayCalendarSync.findUnique({ where: { localeCode } });
  }

  /** Return holiday counts within a period; used by the run engine. */
  async classify(localeCode: string, periodStart: Date, periodEnd: Date) {
    const rows = await this.tp.forCurrentTenant().publicHoliday.findMany({
      where: {
        localeCode,
        date: { gte: periodStart, lte: periodEnd },
      },
    });
    const dates = new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
    const statutoryDates = new Set(
      rows.filter((r) => r.type === 'statutory').map((r) => r.date.toISOString().slice(0, 10)),
    );
    return { allHolidayDates: dates, statutoryDates };
  }
}

// ---- helpers -------------------------------------------------------------

function normalize(s: string) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

interface IcsItem {
  date: string;
  nameEn: string;
  nameZh?: string;
}

/**
 * Tiny iCalendar parser — enough for data.gov.hk: line-folded VEVENTs with
 * DTSTART;VALUE=DATE and SUMMARY. We don't need rrules / timezones / locales.
 */
function parseIcs(ics: string): IcsItem[] {
  const lines = ics.replace(/\r/g, '').split('\n');
  // RFC 5545 line-folding: continuation lines start with a space/tab.
  const unfolded: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  const out: IcsItem[] = [];
  let cur: { date?: string; summary?: string } | null = null;
  for (const l of unfolded) {
    if (l === 'BEGIN:VEVENT') cur = {};
    else if (l === 'END:VEVENT') {
      if (cur?.date && cur?.summary) {
        out.push({
          date: `${cur.date.slice(0, 4)}-${cur.date.slice(4, 6)}-${cur.date.slice(6, 8)}`,
          nameEn: cur.summary,
        });
      }
      cur = null;
    } else if (cur) {
      const [k, ...rest] = l.split(':');
      const v = rest.join(':');
      if (k.startsWith('DTSTART')) cur.date = v.replace(/-/g, '').slice(0, 8);
      else if (k.startsWith('SUMMARY')) cur.summary = v;
    }
  }
  return out;
}

/**
 * HK statutory holidays (Employment Ordinance s.39). The other gazetted
 * holidays are "general" — banks closed but not legally paid-leave days
 * for non-monthly staff.
 */
const STATUTORY_HK_NAMES = [
  "the first day of january",
  "lunar new year's day",
  "the second day of lunar new year",
  "the third day of lunar new year",
  "the fourth day of lunar new year",
  "ching ming festival",
  "labour day",
  "tuen ng festival",
  "hong kong special administrative region establishment day",
  "the day following mid-autumn festival",
  "chung yeung festival",
  "national day",
  "chinese mid-autumn festival",
  "the day following chinese mid-autumn festival",
  "winter solstice",
  "christmas day",
];

/** Fallback list for offline dev (HK 2026 gazetted dates). */
const FALLBACK_HK_HOLIDAYS: IcsItem[] = [
  { date: '2026-01-01', nameEn: 'The first day of January', nameZh: '一月一日' },
  { date: '2026-02-17', nameEn: "Lunar New Year's Day", nameZh: '農曆年初一' },
  { date: '2026-02-18', nameEn: 'The second day of Lunar New Year', nameZh: '農曆年初二' },
  { date: '2026-02-19', nameEn: 'The third day of Lunar New Year', nameZh: '農曆年初三' },
  { date: '2026-04-03', nameEn: 'Good Friday', nameZh: '耶穌受難節' },
  { date: '2026-04-04', nameEn: 'The day following Good Friday', nameZh: '耶穌受難節翌日' },
  { date: '2026-04-06', nameEn: 'Ching Ming Festival', nameZh: '清明節' },
  { date: '2026-04-07', nameEn: 'Easter Monday', nameZh: '復活節星期一' },
  { date: '2026-05-01', nameEn: 'Labour Day', nameZh: '勞動節' },
  { date: '2026-05-25', nameEn: 'The Birthday of the Buddha', nameZh: '佛誕' },
  { date: '2026-06-19', nameEn: 'Tuen Ng Festival', nameZh: '端午節' },
  { date: '2026-07-01', nameEn: 'Hong Kong Special Administrative Region Establishment Day', nameZh: '香港特別行政區成立紀念日' },
  { date: '2026-09-26', nameEn: 'The day following Chinese Mid-Autumn Festival', nameZh: '中秋節翌日' },
  { date: '2026-10-01', nameEn: 'National Day', nameZh: '國慶日' },
  { date: '2026-10-19', nameEn: 'Chung Yeung Festival', nameZh: '重陽節' },
  { date: '2026-12-25', nameEn: 'Christmas Day', nameZh: '聖誕節' },
  { date: '2026-12-26', nameEn: 'The first weekday after Christmas Day', nameZh: '聖誕節後第一個周日' },
];
