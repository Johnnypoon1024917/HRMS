import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { DocumentService, GeneratedDocument } from './document.service';

/** One worksheet in a generated workbook. */
export interface SheetSpec {
  name: string;
  columns: { header: string; key: string; width?: number }[];
  /** Each row is matched to `columns` by key; extra keys are ignored. */
  rows: readonly object[];
}

/** A parsed worksheet: the header row plus every data row as raw string cells. */
export interface ParsedSheet {
  headers: string[];
  /** Data rows (header excluded). `rows[i][j]` is the trimmed cell text. */
  rows: string[][];
}

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Tabular companion to {@link DocumentService}. Owns the *spreadsheet* side of
 * the export framework: building report / gazette / call-list workbooks, and
 * parsing uploaded Excel templates for the bulk-import endpoints (TRM, HBM,
 * EXM). Generalises the one-off ExcelJS logic previously embedded in PimService.
 */
@Injectable()
export class SpreadsheetService {
  constructor(private readonly docs: DocumentService) {}

  /** Build a multi-sheet .xlsx workbook ready for download. */
  async build(sheets: SheetSpec[], filename: string): Promise<GeneratedDocument> {
    const wb = new ExcelJS.Workbook();
    for (const spec of sheets) {
      const ws = wb.addWorksheet(spec.name);
      ws.columns = spec.columns.map((c) => ({
        header: c.header,
        key: c.key,
        width: c.width ?? 20,
      }));
      ws.getRow(1).font = { bold: true };
      spec.rows.forEach((r) => ws.addRow(r));
    }
    // ExcelJS's writeBuffer predates Node 22's parameterised Buffer type; the
    // runtime value is a Buffer, so normalise it here (matches PimService).
    const buf = await wb.xlsx.writeBuffer();
    return { buffer: Buffer.from(buf as any), filename, contentType: XLSX_MIME };
  }

  /** Wrap a generated workbook as a downloadable stream. */
  toStream(doc: GeneratedDocument) {
    return this.docs.toStream(doc);
  }

  /**
   * Parse the first worksheet of an uploaded workbook into header + data rows.
   * Throws BadRequest on an empty / unreadable file so controllers don't have
   * to. Column mapping is left to the caller (templates differ per module).
   */
  async parseFirstSheet(buffer: Buffer): Promise<ParsedSheet> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Unreadable Excel file');
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('Workbook has no worksheets');

    const cell = (v: ExcelJS.CellValue): string => {
      if (v == null) return '';
      if (typeof v === 'object' && 'text' in (v as any)) return String((v as any).text).trim();
      if (typeof v === 'object' && 'result' in (v as any)) return String((v as any).result).trim();
      return String(v).trim();
    };

    let headers: string[] = [];
    const rows: string[][] = [];
    ws.eachRow((row, i) => {
      const cells: string[] = [];
      // ExcelJS row.values is 1-indexed (index 0 is always empty).
      const values = (row.values as ExcelJS.CellValue[]).slice(1);
      for (const v of values) cells.push(cell(v));
      if (i === 1) headers = cells;
      else rows.push(cells);
    });
    return { headers, rows };
  }
}
