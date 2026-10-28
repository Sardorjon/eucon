import { applyListQuery, FieldAccessors } from './query-engine';

interface Row {
  n: string;
  d: string;
  c: number;
}

const rows: Row[] = [
  { n: 'Kundenevent München', d: '2026-11-04', c: 5 },
  { n: 'Messe Berlin', d: '2026-11-01', c: 9 },
  { n: 'Sommerfest Köln', d: '2027-06-10', c: 3 },
  { n: 'Partnertag Berlin', d: '2026-12-01', c: 9 },
];
type F = 'name' | 'date' | 'count';
const fields: FieldAccessors<Row, F> = { name: (r) => r.n, date: (r) => r.d, count: (r) => r.c };

describe('applyListQuery', () => {
  it('filters, then sorts, then counts, then pages', () => {
    const result = applyListQuery(
      rows,
      { skip: 1, take: 1, sort: [{ field: 'date', desc: false }], filter: { field: 'count', op: 'gte', value: 5 } },
      fields,
    );
    expect(result.totalCount).toBe(3);
    expect(result.items.map((r) => r.n)).toEqual(['Kundenevent München']);
  });

  it('contains is case-insensitive and umlaut-safe', () => {
    for (const value of ['MÜNCHEN', 'münchen']) {
      expect(applyListQuery(rows, { skip: 0, filter: { field: 'name', op: 'contains', value } }, fields).totalCount).toBe(1);
    }
    expect(() => applyListQuery(rows, { skip: 0, filter: { field: 'name', op: 'contains', value: '(' } }, fields)).not.toThrow();
    expect(applyListQuery(rows, { skip: 0, filter: { field: 'name', op: 'contains', value: '(' } }, fields).totalCount).toBe(0);
  });

  it('combines and / or / not', () => {
    const result = applyListQuery(
      rows,
      {
        skip: 0,
        filter: {
          and: [
            { or: [{ field: 'name', op: 'contains', value: 'messe' }, { not: { field: 'count', op: 'gt', value: 5 } }] },
            { field: 'date', op: 'lt', value: '2027-01-01' },
          ],
        },
      },
      fields,
    );
    expect(result.items.map((r) => r.n).sort()).toEqual(['Kundenevent München', 'Messe Berlin']);
  });

  it('unknown id yields an empty page', () => {
    expect(applyListQuery(rows, { skip: 0, take: 50, filter: { field: 'name', op: 'eq', value: 'does-not-exist' } }, fields)).toEqual({
      items: [],
      totalCount: 0,
    });
  });

  it('skip beyond total returns empty items with the correct total', () => {
    const result = applyListQuery(rows, { skip: 50, take: 50 }, fields);
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(4);
  });

  it('take undefined returns all; multi-key sort with stable ties', () => {
    const result = applyListQuery(rows, { skip: 0, sort: [{ field: 'count', desc: true }, { field: 'name', desc: false }] }, fields);
    expect(result.items.map((r) => r.n)).toEqual(['Messe Berlin', 'Partnertag Berlin', 'Kundenevent München', 'Sommerfest Köln']);
  });

  it('sorts umlauts with German collation, not by code point', () => {
    const names = ['Zoo', 'Öl', 'Ostern', 'apfel'].map((n) => ({ n, d: '', c: 0 }));
    const result = applyListQuery(names, { skip: 0, sort: [{ field: 'name', desc: false }] }, fields);
    expect(result.items.map((r) => r.n)).toEqual(['apfel', 'Öl', 'Ostern', 'Zoo']);
  });

  it('does not mutate the input', () => {
    const copy = [...rows];
    applyListQuery(rows, { skip: 0, sort: [{ field: 'name', desc: true }] }, fields);
    expect(rows).toEqual(copy);
  });
});
