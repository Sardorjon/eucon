import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { Pipe, PipeTransform } from '@angular/core';
import { readStorage, writeStorage } from '@shared/utils';
import { formatMessage, loadMessages, locale } from 'devextreme/localization';
import dxDe from 'devextreme/localization/messages/de.json';
import { de, flattenMessages, MessageKey } from './messages';

/**
 * App texts are stored in DevExtreme's message registry, so one locale setting covers our UI
 * and every DevExtreme widget (pager, filter row, dialogs). Adding a language = one
 * `<lang>.json` with the same keys + one entry here; the header then shows a switch.
 */
const LOCALES = {
  de: { app: de, dx: dxDe, ng: localeDe },
} as const;

export type AppLocale = keyof typeof LOCALES;
export const SUPPORTED_LOCALES = Object.keys(LOCALES) as AppLocale[];
const STORAGE_KEY = 'app-locale';
const DEFAULT_LOCALE: AppLocale = 'de';
const DEFAULT_MESSAGES = flattenMessages(de);

function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && value in LOCALES;
}

/** Must run before bootstrap: Angular's LOCALE_ID and DevExtreme read it synchronously. */
export function initLocale(): AppLocale {
  const stored = readStorage(STORAGE_KEY);
  const id = isAppLocale(stored) ? stored : DEFAULT_LOCALE;
  for (const [key, entry] of Object.entries(LOCALES)) {
    registerLocaleData(entry.ng, key);
    loadMessages(entry.dx);
    loadMessages({ [key]: flattenMessages(entry.app) });
  }
  locale(id);
  document.documentElement.lang = id;
  return id;
}

export function currentLocale(): AppLocale {
  const id = locale();
  return isAppLocale(id) ? id : DEFAULT_LOCALE;
}

/** DevExtreme widgets cannot switch language at runtime, so a switch reloads the app. */
export function switchLocale(id: AppLocale): void {
  writeStorage(STORAGE_KEY, id);
  location.reload();
}

export function t(key: MessageKey, ...values: (string | number)[]): string {
  return formatMessage(key, ...values.map(String)) || key;
}

/** Translates a message key that may come from data (e.g. a AppError) with a safe fallback. */
export function tKey(key: string, fallback: MessageKey = 'errors.unexpected'): string {
  return key in DEFAULT_MESSAGES ? t(key as MessageKey) : t(fallback);
}

@Pipe({ name: 't' })
export class TranslatePipe implements PipeTransform {
  transform(key: MessageKey, ...values: (string | number)[]): string {
    return t(key, ...values);
  }
}
