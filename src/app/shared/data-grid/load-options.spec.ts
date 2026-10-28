import { parseFilterExpression, toListQuery, UnsupportedQueryError } from './load-options';

const allowed = ['name', 'date', 'statusId', 'locationId'] as const;
const parse = (expr: unknown) => parseFilterExpression(expr, allowed);

describe('parseFilterExpression', () => {
  it('maps a single condition', () => {
    expect(parse(['statusId', '=', 'planned'])).toEqual({ field: 'statusId', op: 'eq', value: 'planned' });
  });

  it('maps header-filter OR groups', () => {
    expect(parse([['statusId', '=', 'a'], 'or', ['statusId', '=', 'b']])).toEqual({
      or: [
        { field: 'statusId', op: 'eq', value: 'a' },
        { field: 'statusId', op: 'eq', value: 'b' },
      ],
    });
  });

  it('maps implicit and explicit AND and negation', () => {
    const a = ['name', 'contains', 'x'];
    const b = ['statusId', '<>', 'y'];
    expect(parse([a, b])).toEqual(parse([a, 'and', b]));
    expect(parse(['!', a])).toEqual({ not: { field: 'name', op: 'contains', value: 'x' } });
  });

  it('converts Date values of a "between" range to local ISO dates', () => {
    expect(parse([['date', '>=', new Date(2026, 10, 1)], 'and', ['date', '<', new Date(2027, 2, 31)]])).toEqual({
      and: [
        { field: 'date', op: 'gte', value: '2026-11-01' },
        { field: 'date', op: 'lt', value: '2027-03-31' },
      ],
    });
  });

  it('maps the search-panel shape', () => {
    expect(parse([['name', 'contains', 'münchen'], 'or', ['locationId', '=', 'loc-muc']])).toEqual({
      or: [
        { field: 'name', op: 'contains', value: 'münchen' },
        { field: 'locationId', op: 'eq', value: 'loc-muc' },
      ],
    });
  });

  it('maps comparison operators', () => {
    for (const [dx, op] of [['<>', 'neq'], ['<', 'lt'], ['<=', 'lte'], ['>', 'gt'], ['>=', 'gte']]) {
      expect(parse(['date', dx, '2026-01-01'])).toEqual({ field: 'date', op, value: '2026-01-01' });
    }
  });

  it('rejects anything outside the whitelist', () => {
    expect(() => parse(['password', '=', 'x'])).toThrow(UnsupportedQueryError);
    expect(() => parse(['name', 'startswith', 'x'])).toThrow(UnsupportedQueryError);
    expect(() => parse([['name', '=', 'a'], 'and', ['name', '=', 'b'], 'or', ['name', '=', 'c']])).toThrow(UnsupportedQueryError);
    expect(() => parse(['name', '=', { $ne: 1 }])).toThrow(UnsupportedQueryError);
    expect(() => parse(['name', '=', null])).toThrow(UnsupportedQueryError);
    let deep: unknown = ['name', '=', 'x'];
    for (let i = 0; i < 10; i++) deep = ['!', deep];
    expect(() => parse(deep)).toThrow(UnsupportedQueryError);
  });
});

describe('toListQuery', () => {
  it('maps paging and sorting', () => {
    expect(toListQuery({ skip: 50, take: 50, sort: [{ selector: 'date', desc: true }] }, allowed)).toEqual({
      skip: 50,
      take: 50,
      sort: [{ field: 'date', desc: true }],
    });
    expect(toListQuery({ sort: 'name' }, allowed).sort).toEqual([{ field: 'name', desc: false }]);
  });

  it('sanitizes paging and rejects unknown sort fields', () => {
    expect(toListQuery({ skip: -5, take: 5000 }, allowed)).toEqual({ skip: 0, take: 1000 });
    expect(toListQuery({}, allowed).take).toBeUndefined();
    expect(() => toListQuery({ sort: [{ selector: 'password' }] }, allowed)).toThrow(UnsupportedQueryError);
  });
});
