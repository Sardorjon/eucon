import query from 'devextreme/data/query';
import { FilterNode, FilterOperator, ListQuery, PagedResult } from './list-query';

/**
 * In-memory "server" for the mock backend. Evaluation is delegated to DevExtreme's array query;
 * this module only translates the backend-agnostic ListQuery into it, so the API contract stays
 * free of DevExtreme types.
 */

/** Maps each queryable field to a value extractor; acts as the field whitelist of a dataset. */
export type FieldAccessors<T, F extends string> = Record<F, (item: T) => string | number | boolean>;

const COLLATOR_OPTIONS: Intl.CollatorOptions = { sensitivity: 'base', numeric: true };
const LANG_PARAMS = { langParams: { locale: 'de', collatorOptions: COLLATOR_OPTIONS } };

/** Locale-aware, case-insensitive text comparison (same rule as list sorting). */
export const compareText = new Intl.Collator('de', COLLATOR_OPTIONS).compare;

const DX_OPERATORS: Record<FilterOperator, string> = {
  eq: '=',
  neq: '<>',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
  contains: 'contains',
};

/** FilterNode → DevExtreme filter expression, with accessor functions as selectors. */
function toDxFilter<T, F extends string>(
  node: FilterNode<F>,
  fields: FieldAccessors<T, F>,
): unknown[] {
  if ('not' in node) return ['!', toDxFilter(node.not, fields)];
  if ('and' in node || 'or' in node) {
    const [connector, parts] =
      'and' in node ? (['and', node.and] as const) : (['or', node.or] as const);
    if (parts.length === 1) return toDxFilter(parts[0], fields);
    return parts.flatMap((part, i) =>
      i === 0 ? [toDxFilter(part, fields)] : [connector, toDxFilter(part, fields)],
    );
  }
  return [fields[node.field], DX_OPERATORS[node.op], node.value];
}

export function filterItems<T, F extends string>(
  items: readonly T[],
  filter: FilterNode<F> | undefined,
  fields: FieldAccessors<T, F>,
): readonly T[] {
  if (!filter) return items;
  return query([...items], LANG_PARAMS)
    .filter(toDxFilter(filter, fields))
    .toArray();
}

/** Simulates server semantics: filter → sort → count → page. Never mutates the input. */
export function applyListQuery<T, F extends string>(
  items: readonly T[],
  { skip, take, sort = [], filter }: ListQuery<F>,
  fields: FieldAccessors<T, F>,
): PagedResult<T> {
  let q = query([...items], LANG_PARAMS);
  if (filter) q = q.filter(toDxFilter(filter, fields));
  sort.forEach(
    ({ field, desc }, i) =>
      (q = i === 0 ? q.sortBy(fields[field], desc) : q.thenBy(fields[field], desc)),
  );
  const matches: T[] = q.toArray();
  const start = Math.max(0, skip);
  return {
    items: take === undefined ? matches.slice(start) : matches.slice(start, start + take),
    totalCount: matches.length,
  };
}
