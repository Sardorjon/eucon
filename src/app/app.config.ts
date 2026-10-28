import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { currentLocale, NotifyService } from '@core';
import { routes } from './app.routes';

class GlobalErrorHandler implements ErrorHandler {
  private readonly notify = inject(NotifyService);

  handleError(error: unknown): void {
    console.error(error);
    this.notify.fromError(error);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: LOCALE_ID, useFactory: currentLocale },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
