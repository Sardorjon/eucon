import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@core';
import { DxButtonModule } from 'devextreme-angular/ui/button';

/** Inline error with a retry action; the one error presentation used by every list and panel. */
@Component({
  selector: 'app-error-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DxButtonModule, TranslatePipe],
  template: `
    <div class="alert-danger d-flex flex-wrap items-center justify-between gap-3" role="alert">
      <span>{{ message() }}</span>
      <dx-button [text]="'common.retry' | t" (onClick)="retry.emit()" />
    </div>
  `,
})
export class ErrorAlert {
  readonly message = input.required<string>();
  readonly retry = output<void>();
}
