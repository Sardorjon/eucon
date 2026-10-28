import { t } from '@core';
import { formatDateTime, parseIsoDate } from '@shared/utils';
import type { DataGridCell } from 'devextreme/common/export/excel';
import type dxDataGrid from 'devextreme/ui/data_grid';
import type { Worksheet } from 'exceljs';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXCEL_DATE_FORMAT = 'dd.mm.yyyy';
/** Time the browser gets to start reading the blob before its URL is released (Safari is slow to start). */
const REVOKE_DELAY_MS = 30_000;

export interface ExcelExportOptions {
  title: string;
  fileName: string;
}

/** Writes title and export date; returns the first row for grid data (one blank row gap). */
export function writeExportHeader(worksheet: Worksheet, title: string, now = new Date()): number {
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16 };
  worksheet.getCell(2, 1).value = t('export.date', formatDateTime(now));
  return 4;
}

/**
 * Writes date columns as real Excel dates with German display format. ExcelJS serializes in UTC,
 * so the calendar day is written as UTC midnight to show the same day in every time zone.
 */
export function customizeDateCell({
  gridCell,
  excelCell,
}: {
  gridCell?: DataGridCell;
  excelCell?: { value: unknown; numFmt?: string };
}): void {
  if (gridCell?.rowType !== 'data' || gridCell.column?.dataType !== 'date' || !excelCell) return;
  const value = gridCell.value;
  const local =
    typeof value === 'string' ? parseIsoDate(value) : value instanceof Date ? value : undefined;
  if (local)
    excelCell.value = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  excelCell.numFmt = EXCEL_DATE_FORMAT;
}

/**
 * Exports the grid's current view (all rows matching filter, search and sort — not just the
 * page; DevExtreme loads them through the grid's own store). ExcelJS is loaded on first use.
 */
export async function exportGridToExcel(
  grid: dxDataGrid,
  { title, fileName }: ExcelExportOptions,
): Promise<void> {
  const [{ exportDataGrid }, { Workbook }] = await Promise.all([
    import('devextreme/excel_exporter'),
    import('exceljs'),
  ]);
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet(title.slice(0, 31));

  await exportDataGrid({
    component: grid,
    worksheet,
    topLeftCell: { row: writeExportHeader(worksheet, title), column: 1 },
    autoFilterEnabled: true,
    keepColumnWidths: true,
    // Recipients may be external: never let cell content become an executable formula.
    encodeExecutableContent: true,
    customizeCell: customizeDateCell,
  });

  downloadBlob(await workbook.xlsx.writeBuffer(), fileName, XLSX_MIME);
}

function downloadBlob(data: BlobPart, fileName: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
  const link = Object.assign(document.createElement('a'), {
    href: url,
    download: fileName,
    rel: 'noopener',
  });
  link.style.display = 'none';
  // Some browsers ignore clicks on detached anchors.
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
