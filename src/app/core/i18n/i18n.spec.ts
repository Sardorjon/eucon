import de from './de.json';
import { initLocale, t, tKey } from './i18n';
import { flattenMessages } from './messages';

describe('i18n', () => {
  beforeAll(() => initLocale());

  it('flattens nested messages into dotted keys', () => {
    expect(flattenMessages({ a: { b: 'x', c: { d: 'y' } }, e: 'z' })).toEqual({ 'a.b': 'x', 'a.c.d': 'y', e: 'z' });
  });

  it('resolves dotted keys from the nested JSON, with placeholders', () => {
    expect(t('events.col.name')).toBe(de.events.col.name);
    expect(t('create.success', 'Messe')).toBe(de.create.success.replace('{0}', 'Messe'));
  });

  it('falls back for unknown keys coming from data (e.g. backend errors)', () => {
    expect(tKey('errors.notFound')).toBe(de.errors.notFound);
    expect(tKey('no.such.key')).toBe(de.errors.unexpected);
  });
});
