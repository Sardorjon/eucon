import { initLocale, t } from '@core';
import type { DataGridCell } from 'devextreme/common/export/excel';
import { exportDataGrid } from 'devextreme/excel_exporter';
import type dxDataGrid from 'devextreme/ui/data_grid';
import { Workbook } from 'exceljs';
import { customizeDateCell, exportGridToExcel, writeExportHeader } from './excel-export';

vi.mock('devextreme/excel_exporter', () => ({ exportDataGrid: vi.fn(() => Promise.resolve()) }));

const grid = {} as dxDataGrid;

describe('excel export', () => {
  beforeAll(() => initLocale());
  beforeEach(() => vi.mocked(exportDataGrid).mockClear());

  it('writes title and export date and leaves one blank row before the data', () => {
    const sheet = new Workbook().addWorksheet('x');
    const firstDataRow = writeExportHeader(sheet, 'Veranstaltungen', new Date(2026, 9, 28, 14, 32));
    expect(sheet.getCell('A1').value).toBe('Veranstaltungen');
    expect(sheet.getCell('A1').font).toMatchObject({ bold: true, size: 16 });
    expect(sheet.getCell('A2').value).toBe(t('export.date', '28.10.2026, 14:32'));
    expect(firstDataRow).toBe(4);
  });

  it('exports dates as UTC midnight so Excel shows the same calendar day in every time zone', () => {
    // ExcelJS serializes Dates in UTC; a local-midnight Date would show the previous day east of UTC.
    for (const value of ['2026-11-04', new Date(2026, 10, 4)]) {
      const excelCell: { value: unknown; numFmt?: string } = { value };
      customizeDateCell({
        gridCell: { rowType: 'data', column: { dataType: 'date' }, value } as DataGridCell,
        excelCell,
      });
      expect((excelCell.value as Date).toISOString()).toBe('2026-11-04T00:00:00.000Z');
      expect(excelCell.numFmt).toBe('dd.mm.yyyy');
    }

    const textCell: { value: unknown; numFmt?: string } = { value: 'Messe' };
    customizeDateCell({
      gridCell: { rowType: 'data', column: { dataType: 'string' }, value: 'Messe' } as DataGridCell,
      excelCell: textCell,
    });
    customizeDateCell({
      gridCell: { rowType: 'header', column: { dataType: 'date' } } as DataGridCell,
      excelCell: textCell,
    });
    expect(textCell).toEqual({ value: 'Messe' });
  });

  it('passes safe export options to DevExtreme and downloads the file', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    await exportGridToExcel(grid, {
      title: 'Veranstaltungen',
      fileName: 'Veranstaltungen_2026-10-28.xlsx',
    });
    expect(exportDataGrid).toHaveBeenCalledWith(
      expect.objectContaining({
        component: grid,
        topLeftCell: { row: 4, column: 1 },
        autoFilterEnabled: true,
        encodeExecutableContent: true,
        keepColumnWidths: true,
      }),
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      'Veranstaltungen_2026-10-28.xlsx',
    );
    click.mockRestore();
  });

  it('rejects and does not download when loading the data fails', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    vi.mocked(exportDataGrid).mockRejectedValueOnce(new Error('backend down'));
    await expect(exportGridToExcel(grid, { title: 'x', fileName: 'x.xlsx' })).rejects.toThrow(
      'backend down',
    );
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });
});
