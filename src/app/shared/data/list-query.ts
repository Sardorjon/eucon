/** Backend-agnostic list contract shared by every paged list (events, locations, invoices, ...). */
export type FilterOperator = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains';

export type FilterValue = string | number | boolean;

export interface FilterCondition<F extends string = string> {
  field: F;
  op: FilterOperator;
  value: FilterValue;
}

export type FilterNode<F extends string = string> =
  FilterCondition<F> | { and: FilterNode<F>[] } | { or: FilterNode<F>[] } | { not: FilterNode<F> };

export interface SortSpec<F extends string = string> {
  field: F;
  desc: boolean;
}

export interface ListQuery<F extends string = string> {
  skip: number;
  /** Undefined means "all matching rows" (used for export). */
  take?: number;
  sort?: SortSpec<F>[];
  filter?: FilterNode<F>;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}
