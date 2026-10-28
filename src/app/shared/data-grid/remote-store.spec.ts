import { AppError, PagedResult } from '@shared/data';
import { defer, Observable, of, throwError } from 'rxjs';
import { UnsupportedQueryError } from './load-options';
import { createRemoteStore } from './remote-store';

interface Row {
  id: string;
  name: string;
}

function failing(times: number): () => Observable<PagedResult<Row>> {
  let calls = 0;
  return () => defer(() => (++calls <= times ? throwError(() => new AppError('errors.unavailable')) : of({ items: [], totalCount: 0 })));
}

describe('createRemoteStore', () => {
  it('maps load options and returns data with totalCount', async () => {
    const onLoadSuccess = vi.fn();
    const load = vi.fn((): Observable<PagedResult<Row>> => of({ items: [{ id: '1', name: 'A' }], totalCount: 42 }));
    const store = createRemoteStore<Row, 'name'>({ key: 'id', fields: ['name'], load, onLoadSuccess });

    const result = await store.load({ skip: 50, take: 50, filter: ['name', 'contains', 'a'], requireTotalCount: true });

    const expected = { skip: 50, take: 50, filter: { field: 'name', op: 'contains', value: 'a' } };
    expect(load).toHaveBeenCalledWith(expected);
    expect(onLoadSuccess).toHaveBeenCalledWith(expected);
    expect(result).toEqual({ data: [{ id: '1', name: 'A' }], totalCount: 42 });
  });

  it('retries transient read errors', async () => {
    const store = createRemoteStore<Row, 'name'>({ key: 'id', fields: ['name'], load: failing(1) });
    await expect(store.load({})).resolves.toEqual({ data: [], totalCount: 0 });
  });

  it('reports persistent and unsupported-query errors once, never as success', async () => {
    const onLoadError = vi.fn();
    const onLoadSuccess = vi.fn();
    const store = createRemoteStore<Row, 'name'>({ key: 'id', fields: ['name'], load: failing(99), onLoadError, onLoadSuccess });
    await expect(store.load({})).rejects.toBeInstanceOf(AppError);
    expect(onLoadError).toHaveBeenCalledTimes(1);

    await expect(store.load({ filter: ['secret', '=', 'x'] })).rejects.toBeInstanceOf(UnsupportedQueryError);
    expect(onLoadError).toHaveBeenCalledTimes(2);
    expect(onLoadSuccess).not.toHaveBeenCalled();
  }, 10_000);

  it('never retries updates', async () => {
    const update = vi.fn(() => throwError(() => new AppError('errors.unavailable')));
    const store = createRemoteStore<Row, 'name'>({ key: 'id', fields: ['name'], load: () => of({ items: [], totalCount: 0 }), update });
    await expect(store.update('1', { name: 'B' })).rejects.toBeInstanceOf(AppError);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
