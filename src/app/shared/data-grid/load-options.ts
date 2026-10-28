import { AppError, FilterNode, FilterOperator, ListQuery, SortSpec } from '@shared/data';
import { toIsoDate } from '@shared/utils';
import type { LoadOptions } from 'devextreme/data';

/** A query outside the list contract (field, operator or value not whitelisted). */
export class UnsupportedQueryError extends AppError {
  constructor(readonly detail: string) {
    super('errors.unsupportedQuery', 400);
  }
}

const OPERATORS: Record<string, FilterOperator> = {
  '=': 'eq',
  '<>': 'neq',
  '<': 'lt',
  '<=': 'lte',
  '>': 'gt',
  '>=': 'gte',
  contains: 'contains',
};
const MAX_DEPTH = 8;
const MAX_TAKE = 1000;

function toValue(value: unknown): string | number | boolean {
  if (value instanceof Date) return toIsoDate(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value;
  throw new UnsupportedQueryError(`Unsupported filter value: ${String(value)}`);
}

function assertField<F extends string>(field: unknown, allowed: readonly F[]): F {
  if (typeof field !== 'string' || !(allowed as readonly string[]).includes(field)) {
    throw new UnsupportedQueryError(`Field not allowed: ${String(field)}`);
  }
  return field as F;
}

function isCondition(expr: unknown[]): boolean {
  return (
    expr.length >= 2 &&
    typeof expr[0] === 'string' &&
    typeof expr[1] === 'string' &&
    expr[0] !== '!'
  );
}

/** Translates a DevExtreme filter expression into a whitelisted FilterNode. */
export function parseFilterExpression<F extends string>(
  expr: unknown,
  allowed: readonly F[],
  depth = 0,
): FilterNode<F> | undefined {
  if (expr == null || (Array.isArray(expr) && expr.length === 0)) return undefined;
  if (!Array.isArray(expr)) throw new UnsupportedQueryError('Filter must be an array');
  if (depth > MAX_DEPTH) throw new UnsupportedQueryError('Filter nested too deeply');

  if (expr[0] === '!') {
    const inner = parseFilterExpression(expr[1], allowed, depth + 1);
    if (!inner) throw new UnsupportedQueryError('Empty negation');
    return { not: inner };
  }

  if (isCondition(expr)) {
    const [field, operator, value] = expr.length === 2 ? [expr[0], '=', expr[1]] : expr;
    const op = OPERATORS[String(operator).toLowerCase()];
    if (!op) throw new UnsupportedQueryError(`Operator not allowed: ${String(operator)}`);
    return { field: assertField(field, allowed), op, value: toValue(value) };
  }

  const nodes: FilterNode<F>[] = [];
  let connector: 'and' | 'or' | undefined;
  for (const part of expr) {
    if (part === 'and' || part === 'or') {
      if (connector && connector !== part)
        throw new UnsupportedQueryError('Mixed and/or in one group');
      connector = part;
      continue;
    }
    const node = parseFilterExpression(part, allowed, depth + 1);
    if (node) nodes.push(node);
  }
  if (nodes.length === 0) return undefined;
  if (nodes.length === 1) return nodes[0];
  return connector === 'or' ? { or: nodes } : { and: nodes };
}

function parseSort<F extends string>(
  sort: unknown,
  allowed: readonly F[],
): SortSpec<F>[] | undefined {
  if (sort == null) return undefined;
  const items = Array.isArray(sort) ? sort : [sort];
  return items.map((item: unknown) => {
    if (typeof item === 'string') return { field: assertField(item, allowed), desc: false };
    const { selector, desc } = (item ?? {}) as { selector?: unknown; desc?: unknown };
    return { field: assertField(selector, allowed), desc: desc === true };
  });
}

/** Boundary between DevExtreme and the app: nothing DevExtreme-specific passes this point. */
export function toListQuery<F extends string>(
  options: LoadOptions,
  allowed: readonly F[],
): ListQuery<F> {
  const skip = Math.max(0, Math.trunc(Number(options.skip) || 0));
  const take =
    options.take == null
      ? undefined
      : Math.min(MAX_TAKE, Math.max(1, Math.trunc(Number(options.take))));
  const query: ListQuery<F> = { skip, take };
  const sort = parseSort(options.sort, allowed);
  if (sort?.length) query.sort = sort;
  const filter = parseFilterExpression(options.filter, allowed);
  if (filter) query.filter = filter;
  return query;
}
