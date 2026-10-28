import { Injectable } from '@angular/core';
import { AppError } from '@shared/data';
import notify from 'devextreme/ui/notify';
import { tKey } from './i18n/i18n';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  success(message: string): void {
    notify(
      { message, type: 'success', displayTime: 3000 },
      { position: 'bottom right', direction: 'up-push' },
    );
  }

  error(message: string): void {
    notify(
      { message, type: 'error', displayTime: 6000 },
      { position: 'bottom right', direction: 'up-push' },
    );
  }

  /** Shows a translated message for app errors (backend, validation, query), a generic one for everything else. */
  fromError(error: unknown): void {
    this.error(error instanceof AppError ? tKey(error.messageKey) : tKey('errors.unexpected'));
  }
}
