import { ListQuery, PagedResult, withReadRetry } from '@shared/data';
import type { LoadOptions } from 'devextreme/data';
import CustomStore from 'devextreme/data/custom_store';
import { firstValueFrom, Observable } from 'rxjs';
import { toListQuery } from './load-options';

export interface RemoteStoreOptions<T, F extends string> {
  key: keyof T & string;
  /** Whitelist of fields the grid may filter/sort on. */
  fields: readonly F[];
  load(query: ListQuery<F>): Observable<PagedResult<T>>;
  update?(key: string, values: Partial<T>): Observable<T>;
  onLoadError?(error: unknown): void;
  /** Called with the query whose result the grid now shows. */
  onLoadSuccess?(query: ListQuery<F>): void;
}

/**
 * Generic adapter: DevExtreme remote paging/sorting/filtering → ListQuery → repository.
 * Any list in the app gets server-side behaviour by providing a `load` function.
 * Stale responses are discarded by the DevExtreme data source (it cancels superseded loads).
 */
export function createRemoteStore<T, F extends string>(
  options: RemoteStoreOptions<T, F>,
): CustomStore<T, string> {
  return new CustomStore<T, string>({
    key: options.key,
    load: async (loadOptions: LoadOptions<T>) => {
      try {
        const query = toListQuery(loadOptions, options.fields);
        const result = await firstValueFrom(options.load(query).pipe(withReadRetry()));
        options.onLoadSuccess?.(query);
        return { data: result.items, totalCount: result.totalCount };
      } catch (error) {
        options.onLoadError?.(error);
        throw error;
      }
    },
    ...(options.update && {
      update: (key: string, values: Partial<T>) => firstValueFrom(options.update!(key, values)),
    }),
  });
}
