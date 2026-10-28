import de from './de.json';

/**
 * UI texts live in nested JSON per locale (grouped by feature), the format translation tools use.
 * Keys are addressed as dotted paths ('events.col.name') and typed from the default locale, so
 * `t('unknown.key')` fails at compile time.
 */
interface MessageTree {
  [key: string]: string | MessageTree;
}

/** All dotted paths to leaf texts of a nested message object. */
type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}`;
}[keyof T & string];

export { de };
export type MessageKey = LeafPaths<typeof de>;

/** DevExtreme's message registry is flat: { 'events.col.name': 'Name', ... }. */
export function flattenMessages(tree: MessageTree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...flat, [path]: value }
      : { ...flat, ...flattenMessages(value, path) };
  }, {});
}
