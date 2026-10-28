import { createGridStateStorage } from './grid-state-storage';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

describe('createGridStateStorage', () => {
  it('round-trips whitelisted state under a versioned key', () => {
    const storage = memoryStorage();
    const s = createGridStateStorage('events-grid', 1, { storage });
    s.save({
      columns: [{ dataField: 'date', sortOrder: 'asc', width: 120, visibleIndex: 2 }],
      searchText: 'messe',
      pageSize: 50,
      pageIndex: 7,
      selectedRowKeys: ['x'],
      focusedRowKey: 'y',
      filterValue: ['statusId', '=', 'planned'],
    });
    expect(JSON.parse(storage.getItem('events-grid:v1')!).v).toBe(1);
    expect(s.load()).toEqual({
      columns: [{ dataField: 'date', sortOrder: 'asc' }],
      searchText: 'messe',
      pageSize: 50,
      filterValue: ['statusId', '=', 'planned'],
    });
  });

  it('returns null for missing, malformed or outdated data', () => {
    const load = (initial: Record<string, string>) =>
      createGridStateStorage('g', 1, { storage: memoryStorage(initial) }).load();
    expect(load({})).toBeNull();
    expect(load({ 'g:v1': '{not json' })).toBeNull();
    expect(load({ 'g:v1': JSON.stringify({ v: 0, state: {} }) })).toBeNull();
    expect(load({ 'g:v1': '"text"' })).toBeNull();
  });

  it('drops invalid values', () => {
    const storage = memoryStorage({
      'g:v1': JSON.stringify({
        v: 1,
        state: { pageSize: 5000, searchText: 'x'.repeat(201), columns: [{ width: 1 }, 'bad'] },
      }),
    });
    expect(createGridStateStorage('g', 1, { storage }).load()).toEqual({ columns: [] });
  });

  it('accepts only the page sizes the grid offers', () => {
    const storage = memoryStorage();
    const s = createGridStateStorage('g', 1, { storage, pageSizes: [10, 20] });
    s.save({ pageSize: 20 });
    expect(s.load()).toEqual({ pageSize: 20 });
    s.save({ pageSize: 50 });
    expect(s.load()).toEqual({});
  });

  it('degrades gracefully without storage or when storage throws', () => {
    const none = createGridStateStorage('g', 1, { storage: null });
    expect(none.load()).toBeNull();
    expect(() => none.save({})).not.toThrow();
    const full = memoryStorage();
    full.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() =>
      createGridStateStorage('g', 1, { storage: full }).save({ pageSize: 25 }),
    ).not.toThrow();
  });
});
