import { readStorage, writeStorage } from '@shared/utils';
import type { StateStoring } from 'devextreme/common/grids';

/**
 * Persists user grid preferences (filters, sort, search, page size) through DevExtreme's
 * stateStoring. Stored data is versioned and whitelisted on both save and load, so stale or
 * tampered values can never reach the grid. Data and transient state are never persisted.
 */
type State = Record<string, unknown>;

export const DEFAULT_PAGE_SIZES: readonly number[] = [25, 50, 100];

const COLUMN_KEYS = [
  'dataField',
  'sortOrder',
  'sortIndex',
  'filterValue',
  'filterValues',
  'filterType',
  'selectedFilterOperation',
];
const MAX_SEARCH = 200;

const isRecord = (value: unknown): value is State =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function pick(source: State, keys: readonly string[]): State {
  return Object.fromEntries(keys.filter((k) => source[k] !== undefined).map((k) => [k, source[k]]));
}

function sanitize(raw: unknown, pageSizes: readonly number[]): State | null {
  if (!isRecord(raw)) return null;
  const state: State = {};
  if (Array.isArray(raw['columns'])) {
    state['columns'] = raw['columns']
      .filter(isRecord)
      .map((c) => pick(c, COLUMN_KEYS))
      .filter((c) => typeof c['dataField'] === 'string');
  }
  if (typeof raw['searchText'] === 'string' && raw['searchText'].length <= MAX_SEARCH)
    state['searchText'] = raw['searchText'];
  if (typeof raw['pageSize'] === 'number' && pageSizes.includes(raw['pageSize']))
    state['pageSize'] = raw['pageSize'];
  if (Array.isArray(raw['filterValue'])) state['filterValue'] = raw['filterValue'];
  return state;
}

export function createGridStateStorage(
  key: string,
  version: number,
  options: { pageSizes?: readonly number[]; storage?: Storage | null } = {},
) {
  const storageKey = `${key}:v${version}`;
  const pageSizes = options.pageSizes ?? DEFAULT_PAGE_SIZES;
  return {
    load(): State | null {
      try {
        const parsed: unknown = JSON.parse(readStorage(storageKey, options.storage) ?? 'null');
        return isRecord(parsed) && parsed['v'] === version
          ? sanitize(parsed['state'], pageSizes)
          : null;
      } catch {
        return null;
      }
    },
    save(state: unknown): void {
      writeStorage(
        storageKey,
        JSON.stringify({ v: version, state: sanitize(state, pageSizes) }),
        options.storage,
      );
    },
  };
}

/** Ready-to-bind `stateStoring` option: `<dx-data-grid [stateStoring]="gridStateStoring('events-grid', 1)">`. */
export function gridStateStoring(
  key: string,
  version: number,
  pageSizes: readonly number[] = DEFAULT_PAGE_SIZES,
): StateStoring {
  const storage = createGridStateStorage(key, version, { pageSizes });
  return {
    enabled: true,
    type: 'custom',
    customLoad: () => Promise.resolve(storage.load()),
    customSave: storage.save,
    savingTimeout: 500,
  };
}
