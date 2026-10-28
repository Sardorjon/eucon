import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { initLocale, t } from '@core';
import { App } from './app';

describe('App', () => {
  beforeEach(() => {
    initLocale();
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });
  });

  it('renders the localized app title and main landmark', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('header')?.textContent).toContain(t('app.title'));
    expect(el.querySelector('nav')?.getAttribute('aria-label')).toBe(t('app.nav'));
    expect(el.querySelector('main')).not.toBeNull();
  });
});
